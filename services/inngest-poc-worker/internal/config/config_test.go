package config

import "testing"

func TestLoadFromEnv(t *testing.T) {
	t.Run("returns an error when INNGEST_BASE_URL is missing", func(t *testing.T) {
		t.Setenv("INNGEST_BASE_URL", "")
		t.Setenv("INNGEST_SIGNING_KEY", "signkey-test-1234")
		t.Setenv("PORT", "8287")

		_, err := LoadFromEnv()
		if err != ErrInngestBaseURLRequired {
			t.Fatalf("expected ErrInngestBaseURLRequired, got %v", err)
		}
	})

	t.Run("returns an error when INNGEST_SIGNING_KEY is missing", func(t *testing.T) {
		t.Setenv("INNGEST_BASE_URL", "http://localhost:8288")
		t.Setenv("INNGEST_SIGNING_KEY", "")
		t.Setenv("PORT", "8287")

		_, err := LoadFromEnv()
		if err != ErrInngestSigningKeyRequired {
			t.Fatalf("expected ErrInngestSigningKeyRequired, got %v", err)
		}
	})

	t.Run("returns an error when PORT is missing", func(t *testing.T) {
		t.Setenv("INNGEST_BASE_URL", "http://localhost:8288")
		t.Setenv("INNGEST_SIGNING_KEY", "signkey-test-1234")
		t.Setenv("PORT", "")

		_, err := LoadFromEnv()
		if err != ErrPortRequired {
			t.Fatalf("expected ErrPortRequired, got %v", err)
		}
	})

	t.Run("loads worker configuration from the environment", func(t *testing.T) {
		t.Setenv("INNGEST_BASE_URL", " http://localhost:8288/ ")
		t.Setenv("INNGEST_SIGNING_KEY", " signkey-test-1234 ")
		t.Setenv("PORT", " 8287 ")

		cfg, err := LoadFromEnv()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if got, want := cfg.BaseURL, "http://localhost:8288"; got != want {
			t.Fatalf("expected BaseURL %q, got %q", want, got)
		}

		if got, want := cfg.SigningKey, "signkey-test-1234"; got != want {
			t.Fatalf("expected SigningKey %q, got %q", want, got)
		}

		if got, want := cfg.Port, "8287"; got != want {
			t.Fatalf("expected Port %q, got %q", want, got)
		}

		if got, want := cfg.RegisterURL(), "http://localhost:8288/fn/register"; got != want {
			t.Fatalf("expected RegisterURL %q, got %q", want, got)
		}
	})
}
