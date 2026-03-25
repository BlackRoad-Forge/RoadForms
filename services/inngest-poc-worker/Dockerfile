FROM golang:1.25.1-alpine AS builder

WORKDIR /app

COPY services/inngest-poc-worker/go.mod services/inngest-poc-worker/go.sum* ./
RUN go mod download

COPY services/inngest-poc-worker ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /inngest-poc-worker ./cmd/inngest-poc-worker

FROM alpine:3.22

RUN adduser -D -u 10001 appuser

COPY --from=builder /inngest-poc-worker /usr/local/bin/inngest-poc-worker

USER appuser

EXPOSE 8287

ENTRYPOINT ["inngest-poc-worker"]
