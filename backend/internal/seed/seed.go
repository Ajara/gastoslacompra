package seed

import "gastoslacompra/internal/extract"

type line struct {
	Quantity  float64
	Name      string
	UnitPrice float64
	Amount    float64
	Note      string
}

func ticket(store, purchasedAt string, total float64, payment, invoice string, lines []line) extract.Ticket {
	out := extract.Ticket{
		Store:         store,
		PurchasedAt:   purchasedAt,
		Total:         total,
		PaymentMethod: &payment,
		InvoiceNumber: &invoice,
		Lines:         make([]extract.Line, 0, len(lines)),
	}
	for _, l := range lines {
		item := extract.Line{
			Quantity:  l.Quantity,
			Name:      l.Name,
			UnitPrice: l.UnitPrice,
			Amount:    l.Amount,
		}
		if l.Note != "" {
			note := l.Note
			item.Note = &note
		}
		out.Lines = append(out.Lines, item)
	}
	return out
}

func Tickets() []extract.Ticket {
	return []extract.Ticket{
		ticket("GRUPO DIA", "2026-08-22T12:07:00.000Z", 2.69, "TARJET.TEF", "1608903-00130961", []line{
			{1, "MINI BOMBÓN CHERRY", 2.69, 2.69, ""},
		}),
		ticket("MERCADONA, S.A.", "2026-08-22T08:08:00.000Z", 76.12, "TARJETA BANCARIA", "3452-017-271075", []line{
			{1, "LECHE DESN P6", 4.92, 4.92, ""},
			{1, "SUAVIZANTE FLORAL", 1.8, 1.8, ""},
			{1, "PATATAS GAJO", 1.65, 1.65, ""},
			{1, "PATATA PREFREG. FINA", 1.85, 1.85, ""},
			{1, "NUEZ CASCARA NATURAL", 3.7, 3.7, ""},
			{1, "PIZZA JAMON Y QUESO", 2.5, 2.5, ""},
			{1, "PIZZA JYQ S/LACT/GLU", 3.2, 3.2, ""},
			{1, "CUARTO TRASERO CONG", 5.7, 5.7, ""},
			{1, "Q. LONCHAS CREMOSO", 2.8, 2.8, ""},
			{1, "GEL CON LEJIA", 1.9, 1.9, ""},
			{1, "ICE TEA MARACUYA", 0.5, 0.5, ""},
			{1, "PAN H BRIOCHE", 1.1, 1.1, ""},
			{2, "PAN M.CEREALES S/GLU", 2.74, 5.48, ""},
			{1, "Q RALLADO FUNDIR", 1.9, 1.9, ""},
			{2, "BATIDO CHOCOLATE PAC", 1.55, 3.1, ""},
			{1, "BOTE CHICLE ORIGINAL", 1.95, 1.95, ""},
			{1, "SURTIDO CROISSANTS", 2.55, 2.55, ""},
			{1, "24 HUEVOS FRESCOS", 5.25, 5.25, ""},
			{1, "NARANJA ZERO P6", 2.22, 2.22, ""},
			{1, "DETERGENTE FRESCURA", 3.5, 3.5, ""},
			{1, "MEJ. CHILE ESCABECHE", 2.65, 2.65, ""},
			{2, "C. SIN GLUTEN LATA", 0.48, 0.96, ""},
			{1, "BARRA DE PAN", 0.5, 0.5, ""},
			{2, "LIMON ZERO LATA", 0.37, 0.74, ""},
			{4, "COCA COLA ZERO ZERO", 0.95, 3.8, ""},
			{1, "LA CIGALA SABOR", 2.45, 2.45, ""},
			{1, "HIGIENICO DOBLE ROLL", 4.6, 4.6, ""},
			{4.076, "MELON PIEL SAPO", 0.7, 2.85, "4,076 kg × 0,70 €/kg"},
		}),
	}
}
