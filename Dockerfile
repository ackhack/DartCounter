FROM nginx:1.27-alpine

# Replace the default site with ours
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/dartcounter.conf

# Static site root
COPY index.html dartboard.png icon-192.png /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80
