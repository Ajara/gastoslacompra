package httpapi

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gastoslacompra/internal/catalog"
	"gastoslacompra/internal/db"
	"gastoslacompra/internal/extract"
	"gastoslacompra/internal/seed"

	"golang.org/x/crypto/bcrypt"
)

const cookieName = "lacompra_session"
const sessionDays = 30

type Config struct {
	Addr         string
	PhotosDir    string
	OpenAIKey    string
	AnthropicKey string
	CookieSecure bool
}

type Server struct {
	http.Server
	db  *db.DB
	cfg Config
}

type ctxUser struct {
	ID    string
	Email string
}

type household struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	InviteCode string `json:"invite_code"`
}

func New(database *db.DB, cfg Config) *Server {
	s := &Server{db: database, cfg: cfg}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /auth/register", s.register)
	mux.HandleFunc("POST /auth/login", s.login)
	mux.HandleFunc("POST /auth/logout", s.logout)
	mux.HandleFunc("GET /me", s.withUser(s.me))
	mux.HandleFunc("POST /households", s.withUser(s.createHousehold))
	mux.HandleFunc("POST /households/join", s.withUser(s.joinHousehold))
	mux.HandleFunc("GET /summary", s.withHousehold(s.summary))
	mux.HandleFunc("POST /extract", s.withHousehold(s.extractTicket))
	mux.HandleFunc("POST /tickets", s.withHousehold(s.saveTicket))
	mux.HandleFunc("POST /tickets/seed", s.withHousehold(s.seedTickets))
	mux.HandleFunc("GET /tickets/{id}", s.withHousehold(s.getTicket))
	mux.HandleFunc("GET /products", s.withHousehold(s.listProducts))
	mux.HandleFunc("GET /products/{id}", s.withHousehold(s.getProduct))
	mux.HandleFunc("PATCH /products/{id}", s.withHousehold(s.patchProduct))
	mux.HandleFunc("GET /photos/{household}/{file}", s.withHousehold(s.photo))

	s.Server = http.Server{
		Addr:              cfg.Addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       120 * time.Second,
		WriteTimeout:      120 * time.Second,
	}
	return s
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || len(body.Password) < 6 {
		writeError(w, http.StatusBadRequest, "Correo y contraseña de al menos 6 caracteres")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "No se pudo crear la cuenta")
		return
	}
	id := db.NewID()
	_, err = s.db.SQL.Exec(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`,
		id, email, string(hash), db.Now())
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			writeError(w, http.StatusConflict, "Ese correo ya tiene cuenta")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.issueSession(w, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": map[string]string{"id": id, "email": email}})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	var id, hash string
	err := s.db.SQL.QueryRow(`SELECT id, password_hash FROM users WHERE email = ?`, email).Scan(&id, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "Correo o contraseña incorrectos")
		return
	}
	if err := s.issueSession(w, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": map[string]string{"id": id, "email": email}})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(cookieName); err == nil {
		_, _ = s.db.SQL.Exec(`DELETE FROM sessions WHERE token_hash = ?`, db.HashToken(c.Value))
	}
	http.SetCookie(w, s.sessionCookie("", -1, time.Time{}))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request, user ctxUser) {
	h, _ := s.householdFor(user.ID)
	writeJSON(w, http.StatusOK, map[string]any{
		"user":      map[string]string{"id": user.ID, "email": user.Email},
		"household": h,
	})
}

func (s *Server) createHousehold(w http.ResponseWriter, r *http.Request, user ctxUser) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return
	}
	name := strings.TrimSpace(body.Name)
	if len(name) < 2 {
		writeError(w, http.StatusBadRequest, "Ponle un nombre a la hucha")
		return
	}
	if existing, _ := s.householdFor(user.ID); existing != nil {
		writeError(w, http.StatusConflict, "Ya perteneces a una hucha")
		return
	}
	hid := db.NewID()
	code := randomInvite()
	now := db.Now()
	tx, err := s.db.SQL.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)`, hid, name, code, now); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if _, err := tx.Exec(`INSERT INTO members (id, household_id, user_id, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
		db.NewID(), hid, user.ID, db.DisplayNameFromEmail(user.Email), now); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, household{ID: hid, Name: name, InviteCode: code})
}

func (s *Server) joinHousehold(w http.ResponseWriter, r *http.Request, user ctxUser) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return
	}
	if existing, _ := s.householdFor(user.ID); existing != nil {
		writeError(w, http.StatusConflict, "Ya perteneces a una hucha")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.Code))
	var h household
	err := s.db.SQL.QueryRow(`SELECT id, name, invite_code FROM households WHERE invite_code = ?`, code).
		Scan(&h.ID, &h.Name, &h.InviteCode)
	if err != nil {
		writeError(w, http.StatusNotFound, "Ese código no existe")
		return
	}
	_, err = s.db.SQL.Exec(`INSERT INTO members (id, household_id, user_id, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
		db.NewID(), h.ID, user.ID, db.DisplayNameFromEmail(user.Email), db.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, h)
}

func (s *Server) summary(w http.ResponseWriter, r *http.Request, user ctxUser, h household) {
	now := time.Now()
	year := queryInt(r, "year", now.Year())
	month := queryInt(r, "month", int(now.Month()))
	start, end := monthRange(year, month)
	prevYear, prevMonth := year, month-1
	if prevMonth == 0 {
		prevMonth = 12
		prevYear--
	}
	prevStart, prevEnd := monthRange(prevYear, prevMonth)

	tickets, err := s.ticketsInRange(h.ID, start, end)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	prevTotal, err := s.sumInRange(h.ID, prevStart, prevEnd)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	total := 0
	byStore := map[string]int{}
	ids := make([]string, 0, len(tickets))
	for _, t := range tickets {
		total += t.TotalCents
		byStore[t.Store] += t.TotalCents
		ids = append(ids, t.ID)
	}
	repeating, err := s.repeating(h.ID, ids)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	stores := make([]map[string]any, 0, len(byStore))
	for store, amount := range byStore {
		stores = append(stores, map[string]any{"store": store, "total_cents": amount})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"year":             year,
		"month":            month,
		"total_cents":      total,
		"prev_total_cents": prevTotal,
		"tickets":          tickets,
		"by_store":         stores,
		"repeating":        repeating,
		"household":        h,
		"user":             map[string]string{"id": user.ID, "email": user.Email},
	})
}

type ticketRow struct {
	ID            string  `json:"id"`
	Store         string  `json:"store"`
	PurchasedAt   string  `json:"purchased_at"`
	TotalCents    int     `json:"total_cents"`
	PaymentMethod *string `json:"payment_method"`
	InvoiceNumber *string `json:"invoice_number"`
	PhotoPath     *string `json:"photo_path"`
	PhotoURL      *string `json:"photo_url"`
	LinesSumCents *int    `json:"lines_sum_cents"`
	Mismatch      bool    `json:"mismatch"`
	CreatedAt     string  `json:"created_at"`
}

type lineRow struct {
	ID          string   `json:"id"`
	TicketID    string   `json:"ticket_id"`
	ProductID   *string  `json:"product_id"`
	RawName     string   `json:"raw_name"`
	Quantity    float64  `json:"quantity"`
	UnitCents   int      `json:"unit_cents"`
	AmountCents int      `json:"amount_cents"`
	VatRate     *float64 `json:"vat_rate"`
	Note        *string  `json:"note"`
}

func (s *Server) extractTicket(w http.ResponseWriter, r *http.Request, _ ctxUser, _ household) {
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "Falta la foto del ticket")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Falta la foto del ticket")
		return
	}
	defer file.Close()
	if header.Size > 8<<20 {
		writeError(w, http.StatusBadRequest, "La foto pesa demasiado (máx. 8 MB)")
		return
	}
	raw, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "No se pudo leer la foto")
		return
	}
	mime := header.Header.Get("Content-Type")
	ticket, err := extract.Receipt(raw, mime, s.cfg.OpenAIKey, s.cfg.AnthropicKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, ticket)
}

func (s *Server) saveTicket(w http.ResponseWriter, r *http.Request, user ctxUser, h household) {
	ct := r.Header.Get("Content-Type")
	var payload savePayload
	var photo []byte
	if strings.HasPrefix(ct, "multipart/form-data") {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "Formulario inválido")
			return
		}
		if err := json.Unmarshal([]byte(r.FormValue("payload")), &payload); err != nil {
			writeError(w, http.StatusBadRequest, "JSON inválido")
			return
		}
		if file, _, err := r.FormFile("photo"); err == nil {
			defer file.Close()
			photo, _ = io.ReadAll(file)
		}
	} else if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	id, err := s.insertTicket(user.ID, h.ID, payload, photo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

type saveLine struct {
	Name        string   `json:"name"`
	Quantity    float64  `json:"quantity"`
	UnitCents   int      `json:"unitCents"`
	AmountCents int      `json:"amountCents"`
	VatRate     *float64 `json:"vatRate"`
	Note        *string  `json:"note"`
}

type savePayload struct {
	TicketID      string     `json:"ticketId"`
	Store         string     `json:"store"`
	PurchasedAt   string     `json:"purchasedAt"`
	TotalCents    int        `json:"totalCents"`
	PaymentMethod *string    `json:"paymentMethod"`
	InvoiceNumber *string    `json:"invoiceNumber"`
	Lines         []saveLine `json:"lines"`
}

func (s *Server) insertTicket(userID, householdID string, payload savePayload, photo []byte) (string, error) {
	id := payload.TicketID
	if id == "" {
		id = db.NewID()
	}
	store := strings.TrimSpace(payload.Store)
	if store == "" {
		store = "Tienda"
	}
	purchased := payload.PurchasedAt
	if purchased == "" {
		purchased = db.Now()
	}
	sum := 0
	for _, line := range payload.Lines {
		sum += line.AmountCents
	}
	mismatch := catalog.IsMismatch(payload.TotalCents, sum)
	var photoPath any
	if len(photo) > 0 {
		dir := filepath.Join(s.cfg.PhotosDir, householdID)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return "", err
		}
		rel := householdID + "/" + id + ".jpg"
		if err := os.WriteFile(filepath.Join(s.cfg.PhotosDir, rel), photo, 0o644); err != nil {
			return "", err
		}
		photoPath = rel
	}

	tx, err := s.db.SQL.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`INSERT INTO tickets (id, household_id, created_by, store, purchased_at, total_cents, payment_method, invoice_number, photo_path, lines_sum_cents, mismatch, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, householdID, userID, store, purchased, payload.TotalCents, payload.PaymentMethod, payload.InvoiceNumber, photoPath, sum, boolToInt(mismatch), db.Now()); err != nil {
		return "", err
	}
	for _, line := range payload.Lines {
		name := strings.TrimSpace(line.Name)
		if name == "" {
			continue
		}
		productID, err := matchOrCreateProduct(tx, householdID, name)
		if err != nil {
			return "", err
		}
		if _, err := tx.Exec(`INSERT INTO ticket_lines (id, ticket_id, household_id, product_id, raw_name, quantity, unit_cents, amount_cents, vat_rate, note, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			db.NewID(), id, householdID, productID, name, line.Quantity, line.UnitCents, line.AmountCents, line.VatRate, line.Note, db.Now()); err != nil {
			return "", err
		}
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return id, nil
}

func (s *Server) seedTickets(w http.ResponseWriter, r *http.Request, user ctxUser, h household) {
	var n int
	if err := s.db.SQL.QueryRow(`SELECT COUNT(*) FROM tickets WHERE household_id = ?`, h.ID).Scan(&n); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n > 0 {
		writeError(w, http.StatusConflict, "La hucha ya tiene tickets")
		return
	}
	for _, t := range seed.Tickets() {
		lines := make([]saveLine, 0, len(t.Lines))
		sum := 0
		for _, l := range t.Lines {
			unit := catalog.EurosToCents(l.UnitPrice)
			amount := catalog.EurosToCents(l.Amount)
			sum += amount
			lines = append(lines, saveLine{
				Name: l.Name, Quantity: l.Quantity, UnitCents: unit, AmountCents: amount, VatRate: l.VatRate, Note: l.Note,
			})
		}
		payload := savePayload{
			Store: t.Store, PurchasedAt: t.PurchasedAt, TotalCents: catalog.EurosToCents(t.Total),
			PaymentMethod: t.PaymentMethod, InvoiceNumber: t.InvoiceNumber, Lines: lines,
		}
		if _, err := s.insertTicket(user.ID, h.ID, payload, nil); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		_ = sum
	}
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (s *Server) getTicket(w http.ResponseWriter, r *http.Request, _ ctxUser, h household) {
	id := r.PathValue("id")
	var t ticketRow
	var mismatch int
	var photo sql.NullString
	var pay, inv sql.NullString
	var linesSum sql.NullInt64
	err := s.db.SQL.QueryRow(`SELECT id, store, purchased_at, total_cents, payment_method, invoice_number, photo_path, lines_sum_cents, mismatch, created_at
		FROM tickets WHERE id = ? AND household_id = ?`, id, h.ID).
		Scan(&t.ID, &t.Store, &t.PurchasedAt, &t.TotalCents, &pay, &inv, &photo, &linesSum, &mismatch, &t.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Ticket no encontrado")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if pay.Valid {
		t.PaymentMethod = &pay.String
	}
	if inv.Valid {
		t.InvoiceNumber = &inv.String
	}
	if photo.Valid {
		t.PhotoPath = &photo.String
		url := "/photos/" + photo.String
		t.PhotoURL = &url
	}
	if linesSum.Valid {
		v := int(linesSum.Int64)
		t.LinesSumCents = &v
	}
	t.Mismatch = mismatch == 1

	rows, err := s.db.SQL.Query(`SELECT id, ticket_id, product_id, raw_name, quantity, unit_cents, amount_cents, vat_rate, note
		FROM ticket_lines WHERE ticket_id = ? ORDER BY created_at ASC`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	lines := []lineRow{}
	for rows.Next() {
		var l lineRow
		var pid sql.NullString
		var vat sql.NullFloat64
		var note sql.NullString
		if err := rows.Scan(&l.ID, &l.TicketID, &pid, &l.RawName, &l.Quantity, &l.UnitCents, &l.AmountCents, &vat, &note); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if pid.Valid {
			l.ProductID = &pid.String
		}
		if vat.Valid {
			l.VatRate = &vat.Float64
		}
		if note.Valid {
			l.Note = &note.String
		}
		lines = append(lines, l)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ticket": t, "lines": lines, "household": h})
}

func (s *Server) listProducts(w http.ResponseWriter, r *http.Request, _ ctxUser, h household) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	query := `SELECT p.id, p.canonical_name, p.category,
		COALESCE(COUNT(l.id), 0), COALESCE(SUM(l.amount_cents), 0)
		FROM products p
		LEFT JOIN ticket_lines l ON l.product_id = p.id
		WHERE p.household_id = ?`
	args := []any{h.ID}
	if q != "" {
		query += ` AND p.canonical_name LIKE ?`
		args = append(args, "%"+q+"%")
	}
	query += ` GROUP BY p.id ORDER BY p.canonical_name LIMIT 80`
	rows, err := s.db.SQL.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, cat string
		var count, spent int
		if err := rows.Scan(&id, &name, &cat, &count, &spent); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, map[string]any{
			"id": id, "canonical_name": name, "category": cat, "count": count, "spent_cents": spent,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"products": out, "household": h})
}

func (s *Server) getProduct(w http.ResponseWriter, r *http.Request, _ ctxUser, h household) {
	id := r.PathValue("id")
	var name, cat string
	err := s.db.SQL.QueryRow(`SELECT canonical_name, category FROM products WHERE id = ? AND household_id = ?`, id, h.ID).Scan(&name, &cat)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Producto no encontrado")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rows, err := s.db.SQL.Query(`SELECT l.id, l.quantity, l.unit_cents, l.amount_cents, t.id, t.store, t.purchased_at
		FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
		WHERE l.product_id = ? AND l.household_id = ?
		ORDER BY t.purchased_at ASC`, id, h.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	history := []map[string]any{}
	for rows.Next() {
		var lineID, ticketID, store, purchased string
		var qty float64
		var unit, amount int
		if err := rows.Scan(&lineID, &qty, &unit, &amount, &ticketID, &store, &purchased); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		history = append(history, map[string]any{
			"id": lineID, "quantity": qty, "unit_cents": unit, "amount_cents": amount,
			"ticket_id": ticketID, "store": store, "purchased_at": purchased,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"product":   map[string]string{"id": id, "canonical_name": name, "category": cat},
		"history":   history,
		"household": h,
	})
}

func (s *Server) patchProduct(w http.ResponseWriter, r *http.Request, _ ctxUser, h household) {
	id := r.PathValue("id")
	var body struct {
		Category string `json:"category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return
	}
	switch body.Category {
	case "comida", "bebida", "limpieza", "otros":
	default:
		writeError(w, http.StatusBadRequest, "Categoría no válida")
		return
	}
	res, err := s.db.SQL.Exec(`UPDATE products SET category = ? WHERE id = ? AND household_id = ?`, body.Category, id, h.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "Producto no encontrado")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) photo(w http.ResponseWriter, r *http.Request, _ ctxUser, h household) {
	hid := r.PathValue("household")
	file := r.PathValue("file")
	if hid != h.ID || strings.Contains(file, "..") || strings.Contains(file, "/") {
		writeError(w, http.StatusForbidden, "Foto no disponible")
		return
	}
	path := filepath.Join(s.cfg.PhotosDir, hid, file)
	http.ServeFile(w, r, path)
}

func matchOrCreateProduct(tx *sql.Tx, householdID, rawName string) (string, error) {
	alias := catalog.NormalizeAlias(rawName)
	var productID string
	err := tx.QueryRow(`SELECT product_id FROM product_aliases WHERE household_id = ? AND alias = ?`, householdID, alias).Scan(&productID)
	if err == nil {
		return productID, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	productID = db.NewID()
	if _, err := tx.Exec(`INSERT INTO products (id, household_id, canonical_name, category, created_at) VALUES (?, ?, ?, ?, ?)`,
		productID, householdID, strings.TrimSpace(rawName), catalog.Categorize(rawName), db.Now()); err != nil {
		return "", err
	}
	if _, err := tx.Exec(`INSERT INTO product_aliases (id, product_id, household_id, alias) VALUES (?, ?, ?, ?)`,
		db.NewID(), productID, householdID, alias); err != nil {
		return "", err
	}
	return productID, nil
}

func (s *Server) ticketsInRange(householdID, start, end string) ([]ticketRow, error) {
	rows, err := s.db.SQL.Query(`SELECT id, store, purchased_at, total_cents, mismatch, created_at, invoice_number
		FROM tickets WHERE household_id = ? AND purchased_at >= ? AND purchased_at < ? ORDER BY purchased_at DESC`,
		householdID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ticketRow{}
	for rows.Next() {
		var t ticketRow
		var mismatch int
		var inv sql.NullString
		if err := rows.Scan(&t.ID, &t.Store, &t.PurchasedAt, &t.TotalCents, &mismatch, &t.CreatedAt, &inv); err != nil {
			return nil, err
		}
		t.Mismatch = mismatch == 1
		if inv.Valid {
			t.InvoiceNumber = &inv.String
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Server) sumInRange(householdID, start, end string) (int, error) {
	var total sql.NullInt64
	err := s.db.SQL.QueryRow(`SELECT SUM(total_cents) FROM tickets WHERE household_id = ? AND purchased_at >= ? AND purchased_at < ?`,
		householdID, start, end).Scan(&total)
	if err != nil {
		return 0, err
	}
	if !total.Valid {
		return 0, nil
	}
	return int(total.Int64), nil
}

func (s *Server) repeating(householdID string, ticketIDs []string) ([]map[string]any, error) {
	if len(ticketIDs) == 0 {
		return []map[string]any{}, nil
	}
	placeholders := strings.Repeat("?,", len(ticketIDs))
	placeholders = placeholders[:len(placeholders)-1]
	args := make([]any, 0, len(ticketIDs)+1)
	args = append(args, householdID)
	for _, id := range ticketIDs {
		args = append(args, id)
	}
	q := fmt.Sprintf(`SELECT p.id, p.canonical_name, p.category, COUNT(l.id), SUM(l.amount_cents)
		FROM ticket_lines l JOIN products p ON p.id = l.product_id
		WHERE l.household_id = ? AND l.ticket_id IN (%s)
		GROUP BY p.id HAVING COUNT(l.id) >= 2
		ORDER BY SUM(l.amount_cents) DESC LIMIT 6`, placeholders)
	rows, err := s.db.SQL.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, cat string
		var count, spent int
		if err := rows.Scan(&id, &name, &cat, &count, &spent); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "name": name, "category": cat, "count": count, "spent": spent})
	}
	return out, rows.Err()
}

func (s *Server) withUser(fn func(http.ResponseWriter, *http.Request, ctxUser)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.currentUser(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "No autenticado")
			return
		}
		fn(w, r, user)
	}
}

func (s *Server) withHousehold(fn func(http.ResponseWriter, *http.Request, ctxUser, household)) http.HandlerFunc {
	return s.withUser(func(w http.ResponseWriter, r *http.Request, user ctxUser) {
		h, err := s.householdFor(user.ID)
		if err != nil || h == nil {
			writeError(w, http.StatusConflict, "No hay hucha")
			return
		}
		fn(w, r, user, *h)
	})
}

func (s *Server) currentUser(r *http.Request) (ctxUser, error) {
	c, err := r.Cookie(cookieName)
	if err != nil || c.Value == "" {
		return ctxUser{}, errors.New("no session")
	}
	var user ctxUser
	var expires string
	err = s.db.SQL.QueryRow(`SELECT u.id, u.email, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
		db.HashToken(c.Value)).Scan(&user.ID, &user.Email, &expires)
	if err != nil {
		return ctxUser{}, err
	}
	exp, err := time.Parse(time.RFC3339Nano, expires)
	if err != nil {
		exp, err = time.Parse(time.RFC3339, expires)
	}
	if err != nil || time.Now().After(exp) {
		return ctxUser{}, errors.New("expired")
	}
	return user, nil
}

func (s *Server) householdFor(userID string) (*household, error) {
	var h household
	err := s.db.SQL.QueryRow(`SELECT h.id, h.name, h.invite_code FROM members m JOIN households h ON h.id = m.household_id WHERE m.user_id = ?`,
		userID).Scan(&h.ID, &h.Name, &h.InviteCode)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

func (s *Server) issueSession(w http.ResponseWriter, userID string) error {
	token, err := db.RandomToken()
	if err != nil {
		return err
	}
	exp := time.Now().Add(sessionDays * 24 * time.Hour).UTC()
	if _, err := s.db.SQL.Exec(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
		db.HashToken(token), userID, exp.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	http.SetCookie(w, s.sessionCookie(token, sessionDays*24*60*60, exp))
	return nil
}

func (s *Server) sessionCookie(value string, maxAge int, exp time.Time) *http.Cookie {
	c := &http.Cookie{
		Name:     cookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
	}
	if !exp.IsZero() {
		c.Expires = exp
	}
	return c
}

func randomInvite() string {
	const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	out := make([]byte, 6)
	for i := range out {
		out[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(out)
}

func monthRange(year, month int) (string, string) {
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)
	return start.Format(time.RFC3339), end.Format(time.RFC3339)
}

func queryInt(r *http.Request, key string, fallback int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
