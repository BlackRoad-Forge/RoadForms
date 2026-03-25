package config

import (
	"errors"
	"net/url"
	"os"
	"strings"
)

const (
	DefaultRiverSchema = "river"
)

var ErrDatabaseURLRequired = errors.New("DATABASE_URL is required")

var prismaUnsupportedQueryParams = []string{
	"connection_limit",
	"pgbouncer",
	"pool_timeout",
	"schema",
	"socket_timeout",
	"statement_cache_size",
}

type Config struct {
	DatabaseURL string
	RiverSchema string
}

func LoadFromEnv() (Config, error) {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		return Config{}, ErrDatabaseURLRequired
	}

	return Config{
		DatabaseURL: sanitizeDatabaseURL(databaseURL),
		RiverSchema: DefaultRiverSchema,
	}, nil
}

func sanitizeDatabaseURL(databaseURL string) string {
	parsedURL, err := url.Parse(databaseURL)
	if err != nil || parsedURL.Scheme == "" {
		return databaseURL
	}

	query := parsedURL.Query()
	for _, key := range prismaUnsupportedQueryParams {
		query.Del(key)
	}

	parsedURL.RawQuery = query.Encode()
	return parsedURL.String()
}
