web: node ./backend/server/index.js
faiss: gunicorn --timeout 600 -w 1 -b 0.0.0.0:$PORT -k gevent backend.server.llm.faiss_server:app
