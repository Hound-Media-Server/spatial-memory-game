FROM python:3.11-slim

WORKDIR /app

COPY . /app

ENV PORT=1212

EXPOSE 1212

CMD ["python", "server.py"]
