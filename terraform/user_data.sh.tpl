#!/bin/bash
# sudo snap install docker
sudo add-apt-repository -y ppa:certbot/certbot
sudo apt-get update
sudo apt-get install -y nginx certbot python-certbot-nginx

ends="%{ for tunnel in local_tunnels }
${tunnel.full_domain}:${tunnel.proxyport}
%{ endfor }"

certbot_domains=""
certbot_domains="%{ for tunnel in local_tunnels }${tunnel.full_domain},%{ endfor }"
certbot_domains=$${certbot_domains%","}

echo $certbot_domains > /verify_certbot_domains
echo $ends > /verify_ends
echo "${public_key}" >> /home/ubuntu/.ssh/authorized_keys;

for TUNNEL in $ends; do
  DOMAIN=$(echo "$TUNNEL" | awk -F ":" '{print $1}')
  PROXY_PORT=$(echo "$TUNNEL" | awk -F ":" '{print $2}')
  
  touch /etc/nginx/conf.d/"$DOMAIN".conf
  FILE=/etc/nginx/conf.d/"$DOMAIN".conf

  cat > $FILE <<- EOM
  server {
      listen       80;
      server_name  $DOMAIN;

      location / {
        proxy_set_header Host            \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_pass http://localhost:$PROXY_PORT;
      }
      error_page   500 502 503 504  /50x.html;
      location = /50x.html {
        return 504 "ERROR tolocal host: \$host. It looks like your local ssh tunnels are down. Try 'sudo tolocal up' ";
      }
  }

EOM

done;

sudo service nginx restart

sudo certbot --nginx --domains "$certbot_domains" --agree-tos --email email@dummyplaceholder.com --non-interactive  --redirect