package extract

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const systemPrompt = `Eres un extractor de tickets de supermercado de España (Mercadona, DIA, Carrefour, Lidl, Aldi, Alcampo, etc.).
Devuelves SOLO un JSON válido con este esquema:
{
  "store": string,
  "purchasedAt": string (ISO-8601, fecha y hora del ticket),
  "total": number (euros, con punto decimal),
  "paymentMethod": string | null,
  "invoiceNumber": string | null,
  "lines": [
    {
      "quantity": number,
      "name": string,
      "unitPrice": number,
      "amount": number,
      "vatRate": number | null,
      "note": string | null
    }
  ]
}

Reglas:
- Cada producto del ticket es una línea. No inventes productos.
- quantity es 1 si no hay cantidad. Si pone "2 PAN..." quantity=2. Si es a peso, quantity es los kg (ej. 4.076) y unitPrice el €/kg.
- amount es el importe de la línea (lo que se paga por ese producto).
- unitPrice es el precio unitario; si no aparece, usa amount/quantity.
- name en mayúsculas como en el ticket, sin el importe.
- Ignora publicidad, fidelización, desglose IVA como líneas de producto, y el cargo de tarjeta.
- total es el TOTAL A PAGAR, no la base imponible.
- Números en formato JSON (76.12 no 76,12).`

type Line struct {
	Quantity  float64  `json:"quantity"`
	Name      string   `json:"name"`
	UnitPrice float64  `json:"unitPrice"`
	Amount    float64  `json:"amount"`
	VatRate   *float64 `json:"vatRate"`
	Note      *string  `json:"note"`
}

type Ticket struct {
	Store         string  `json:"store"`
	PurchasedAt   string  `json:"purchasedAt"`
	Total         float64 `json:"total"`
	PaymentMethod *string `json:"paymentMethod"`
	InvoiceNumber *string `json:"invoiceNumber"`
	Lines         []Line  `json:"lines"`
}

type Model struct {
	ID          string
	Detail      string
	Hint        string
	Temperature *float64
	Reasoning   string
	MaxTokens   int
}

func f64(v float64) *float64 { return &v }

func ResolveModel(name string) Model {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "accurate", "preciso", "gpt-4o", "gpt-5.6-sol":
		return Model{
			ID:        "gpt-5.6-sol",
			Detail:    "original",
			Hint:      "El ticket puede estar arrugado, borroso o a contraluz. Transcribe cada línea visible. No inventes productos. Si un precio no se lee, omite la línea o pon note indicando duda.",
			Reasoning: "medium",
			MaxTokens: 8000,
		}
	default:
		return Model{
			ID:          "gpt-4o-mini",
			Detail:      "auto",
			Hint:        "Extrae todas las líneas de este ticket.",
			Temperature: f64(0),
		}
	}
}

func Receipt(image []byte, mime, openaiKey, anthropicKey, modelName string) (*Ticket, error) {
	if mime == "" {
		mime = "image/jpeg"
	}
	b64 := base64.StdEncoding.EncodeToString(image)
	model := ResolveModel(modelName)
	if openaiKey != "" {
		return withOpenAI(b64, mime, openaiKey, model)
	}
	if anthropicKey != "" {
		return withAnthropic(b64, mime, anthropicKey)
	}
	return nil, fmt.Errorf("falta OPENAI_API_KEY o ANTHROPIC_API_KEY para leer el ticket")
}

func withOpenAI(b64, mime, apiKey string, model Model) (*Ticket, error) {
	payload := map[string]any{
		"model":           model.ID,
		"response_format": map[string]string{"type": "json_object"},
		"messages": []any{
			map[string]string{"role": "system", "content": systemPrompt},
			map[string]any{
				"role": "user",
				"content": []any{
					map[string]string{"type": "text", "text": model.Hint},
					map[string]any{
						"type": "image_url",
						"image_url": map[string]string{
							"url":    "data:" + mime + ";base64," + b64,
							"detail": model.Detail,
						},
					},
				},
			},
		},
	}
	if model.Temperature != nil {
		payload["temperature"] = *model.Temperature
	}
	if model.Reasoning != "" {
		payload["reasoning_effort"] = model.Reasoning
	}
	if model.MaxTokens > 0 {
		payload["max_completion_tokens"] = model.MaxTokens
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("OpenAI %d: %s", resp.StatusCode, trim(raw, 400))
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("OpenAI no devolvió contenido")
	}
	return parseTicket(parsed.Choices[0].Message.Content)
}

func withAnthropic(b64, mime, apiKey string) (*Ticket, error) {
	if mime != "image/png" && mime != "image/webp" && mime != "image/gif" {
		mime = "image/jpeg"
	}
	payload := map[string]any{
		"model":       "claude-sonnet-4-20250514",
		"max_tokens":  8000,
		"temperature": 0,
		"system":      systemPrompt,
		"messages": []any{
			map[string]any{
				"role": "user",
				"content": []any{
					map[string]any{
						"type": "image",
						"source": map[string]string{
							"type":       "base64",
							"media_type": mime,
							"data":       b64,
						},
					},
					map[string]string{"type": "text", "text": "Extrae todas las líneas de este ticket."},
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Anthropic %d: %s", resp.StatusCode, trim(raw, 400))
	}
	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	text := ""
	for _, block := range parsed.Content {
		if block.Type == "text" {
			text = block.Text
			break
		}
	}
	if text == "" {
		return nil, fmt.Errorf("Anthropic no devolvió contenido")
	}
	return parseTicket(text)
}

func parseTicket(raw string) (*Ticket, error) {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var t Ticket
	if err := json.Unmarshal([]byte(cleaned), &t); err != nil {
		return nil, fmt.Errorf("la extracción no devolvió un ticket válido")
	}
	if t.Lines == nil || (t.Total == 0 && len(t.Lines) == 0) {
		return nil, fmt.Errorf("la extracción no devolvió un ticket válido")
	}
	if t.Store == "" {
		t.Store = "Tienda"
	}
	if t.PurchasedAt == "" {
		t.PurchasedAt = time.Now().UTC().Format(time.RFC3339)
	}
	for i := range t.Lines {
		if t.Lines[i].Quantity == 0 {
			t.Lines[i].Quantity = 1
		}
		if strings.TrimSpace(t.Lines[i].Name) == "" {
			t.Lines[i].Name = "Producto"
		}
	}
	return &t, nil
}

func trim(b []byte, n int) string {
	s := string(b)
	if len(s) > n {
		return s[:n]
	}
	return s
}
