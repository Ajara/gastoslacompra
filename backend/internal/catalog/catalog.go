package catalog

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var (
	limpieza = regexp.MustCompile(`(?i)suavizante|lej[ií]a|detergente|higienico|higi[eé]nico|limpiador|lavavajillas|gel con lejia|papel (higienico|wc)|bayeta|lejia`)
	bebida   = regexp.MustCompile(`(?i)cola|ice tea|zumo|batido|cerveza|agua |naranja zero|limon zero|lim[oó]n zero|coca cola|refresco`)
	otros    = regexp.MustCompile(`(?i)chicle|bolsa|pilas?|mecheros?|tabaco`)
	nonAlias = regexp.MustCompile(`[^A-Z0-9./+\- ]+`)
	spaces   = regexp.MustCompile(`\s+`)
)

func Categorize(name string) string {
	if limpieza.MatchString(name) {
		return "limpieza"
	}
	if otros.MatchString(name) {
		return "otros"
	}
	if bebida.MatchString(name) {
		return "bebida"
	}
	return "comida"
}

func NormalizeAlias(name string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	s, _, err := transform.String(t, name)
	if err != nil {
		s = name
	}
	s = strings.ToUpper(s)
	s = nonAlias.ReplaceAllString(s, " ")
	s = spaces.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

func EurosToCents(v float64) int {
	if v < 0 {
		return int(v*100 - 0.5)
	}
	return int(v*100 + 0.5)
}

func IsMismatch(total, sum int) bool {
	d := total - sum
	if d < 0 {
		d = -d
	}
	return d > 2
}
