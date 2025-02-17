web: bash -c 'export FAISS_SERVER_URL=$(heroku logs -a rtut-app-admin-server | grep "Listening at:" | tail -1 | awk "{print \$6}"); node ./backend/server/index.js'
faiss: gunicorn --timeout 600 -w 1 -b 0.0.0.0:$PORT -k gevent backend.server.llm.faiss_server:app
