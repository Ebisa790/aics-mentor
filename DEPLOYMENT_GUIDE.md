# Production Deployment Guide

## 1. Local Development (.env - current)
- ENVIRONMENT=development
- MOCK_PAYMENT=true
- SMTP: Brevo (smtp-relay.brevo.com)

## 2. Production (Railway/Render Dashboard)

Copy these values to your hosting platform:

### Database
DATABASE_URL=postgresql://user:password@production-db:5432/exitai_db

### Security
SECRET_KEY=aYxNb-rf4OBqkhihY8TOuX4B-CeLv-vTYxv_Mg1R9mo
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

### Redis
REDIS_URL=redis://production-redis:6379/0
CELERY_BROKER_URL=redis://production-redis:6379/0
CELERY_RESULT_BACKEND=redis://production-redis:6379/0

### AI APIs
GROQ_API_KEY=your-groq-key
GEMINI_API_KEYS=your-gemini-key
DEEPSEEK_API_KEY=your-deepseek-key
OPENROUTER_API_KEY=your-openrouter-key

### Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

### Payment (Chapa)
CHAPA_SECRET_KEY=your-production-chapa-key
CHAPA_WEBHOOK_SECRET=your-webhook-secret
CHAPA_API_URL=https://api.chapa.co/v1
CHAPA_CALLBACK_URL=https://yourdomain.com/api/payments/webhook
MOCK_PAYMENT=false

### Email (Brevo)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=b5c858001@smtp-brevo.com
SMTP_PASSWORD=your-brevo-smtp-password
SMTP_FROM_EMAIL=no-reply@exitai-ethiopia.com

### Monitoring
SENTRY_DSN=your-sentry-dsn

### Domain
ALLOWED_HOSTS=yourdomain.com
FRONTEND_ORIGIN=https://yourdomain.com
ENVIRONMENT=production
