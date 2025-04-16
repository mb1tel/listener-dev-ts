FROM nginx:alpine

# Copy our custom Nginx config
COPY ./public-nginx.conf /etc/nginx/conf.d/default.conf

# Copy web application files
COPY ./public /usr/share/nginx/html

# Copy entrypoint script
COPY ./public/nginx-entrypoint.sh /docker-entrypoint.d/40-config-socketio.sh

# Make sure the script is executable
RUN chmod +x /docker-entrypoint.d/40-config-socketio.sh

# Expose the web port
EXPOSE 80

# The default entrypoint from nginx:alpine will run scripts in /docker-entrypoint.d/
# and then start Nginx 