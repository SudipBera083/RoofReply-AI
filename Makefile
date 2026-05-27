.PHONY: build up down restart logs migrate makemigrations shell createsuperuser test

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose down && docker-compose up -d

logs:
	docker-compose logs -f

migrate:
	docker-compose exec backend python manage.py migrate

makemigrations:
	docker-compose exec backend python manage.py makemigrations

shell:
	docker-compose exec backend python manage.py shell

createsuperuser:
	docker-compose exec backend python manage.py createsuperuser

test:
	docker-compose exec backend python manage.py test
