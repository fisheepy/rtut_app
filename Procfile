web: node ./backend/server/index.js
faiss: gunicorn --timeout 600 -w 1 -b 0.0.0.0:5001 -k gevent backend.server.llm.faiss_server:app
