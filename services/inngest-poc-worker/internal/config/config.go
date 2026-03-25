package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
)

var (
	ErrInngestBaseURLRequired    = errors.New("INNGEST_BASE_URL is required")
	ErrInngestSigningKeyRequired = errors.New("INNGEST_SIGNING_KEY is required")
	ErrPortRequired              = errors.New("PORT is required")
)

type Config struct {
	BaseURL    string
	SigningKey string
	Port       string
}

func LoadFromEnv() (Config, error) {
	baseURL := strings.TrimSpace(os.Getenv("INNGEST_BASE_URL"))
	if baseURL == "" {
		return Config{}, ErrInngestBaseURLRequired
	}

	signingKey := strings.TrimSpace(os.Getenv("INNGEST_SIGNING_KEY"))
	if signingKey == "" {
		return Config{}, ErrInngestSigningKeyRequired
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		return Config{}, ErrPortRequired
	}

	parsedURL, err := url.Parse(baseURL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		return Config{}, fmt.Errorf("invalid INNGEST_BASE_URL: %s", baseURL)
	}

	return Config{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		SigningKey: signingKey,
		Port:       port,
	}, nil
}

func (c Config) RegisterURL() string {
	return c.BaseURL + "/fn/register"
}
