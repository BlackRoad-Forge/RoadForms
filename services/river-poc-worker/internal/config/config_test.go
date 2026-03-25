package config

import "testing"

func TestLoadFromEnv(t *testing.T) {
	t.Run("returns an error when DATABASE_URL is missing", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "")

		_, err := LoadFromEnv()
		if err != ErrDatabaseURLRequired {
			t.Fatalf("expected ErrDatabaseURLRequired, got %v", err)
		}
	})

	t.Run("loads database configuration from environment", func(t *testing.T) {
		t.Setenv(
			"DATABASE_URL",
			"  postgres://formbricks:password@localhost:5432/formbricks?connection_limit=5&schema=formbricks&sslmode=disable  ",
		)

		cfg, err := LoadFromEnv()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if got, want := cfg.DatabaseURL, "postgres://formbricks:password@localhost:5432/formbricks?sslmode=disable"; got != want {
			t.Fatalf("expected DatabaseURL %q, got %q", want, got)
		}

		if got, want := cfg.RiverSchema, DefaultRiverSchema; got != want {
			t.Fatalf("expected RiverSchema %q, got %q", want, got)
		}
	})
}
