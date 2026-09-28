FROM nginx:alpine

# Security patch: upgrade libexpat to fix CVE-2026-93990
# (XML Injection via Malformed UTF-16 Input, severity HIGH)
# Installed in base image: libexpat-2.8.4-r0
# Fixed version:           libexpat-2.8.5-r0 (Alpine 3.24 main repo)
# Source:  https://avd.aquasec.com/nvd/cve-2026-93990
# Remove this line once nginx:alpine ships with libexpat >= 2.8.5-r0 in the base image.
RUN apk upgrade --no-cache libexpat

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
