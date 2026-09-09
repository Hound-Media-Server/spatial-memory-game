# Spatial Memory Game

It is said that chimpanzees can play this game better than humans...

To deploy, copy the compose file below, run `docker compose up -d`, and open http://localhost:1212

```
services:
  spatial-memory-game:
    image: houndmediaserver/spatial-memory-game:latest
    ports:
      - "1212:1212"
    environment:
      - PORT=1212
      - SCORE_SECRET=whatever
      - DATA_DIR=/app/data
    volumes:
      - ./data:/app/data
```

