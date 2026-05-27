#!/bin/sh

echo "Waiting for postgres..."
# simple retry loop to verify database readiness
until python -c "import sys, psycopg2; psycopg2.connect(dbname='${DB_NAME}', user='${DB_USER}', password='${DB_PASSWORD}', host='${DB_HOST}', port='${DB_PORT}')" 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping..."
  sleep 1
done
echo "PostgreSQL is up and running!"

# Run migrations
echo "Generating database migrations..."
python manage.py makemigrations --noinput

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Starting Django development server..."
python manage.py runserver 0.0.0.0:8000
