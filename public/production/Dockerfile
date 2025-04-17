FROM nginx:alpine

# Copy file HTML
COPY ../production.html /usr/share/nginx/html/index.html

# Copy nginx config
COPY ./production/default.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
