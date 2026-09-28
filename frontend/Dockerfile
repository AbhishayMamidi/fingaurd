# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine

# Security patch: upgrade libexpat to fix CVE-2026-93990
# (XML Injection via Malformed UTF-16 Input, severity HIGH)
# Installed in base image: libexpat-2.8.4-r0
# Fixed version:           libexpat-2.8.5-r0 (Alpine 3.24 main repo)
# Source:  https://avd.aquasec.com/nvd/cve-2026-93990
# Remove this line once nginx:alpine ships with libexpat >= 2.8.5-r0 in the base image.
RUN apk upgrade --no-cache libexpat

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
