#!/usr/bin/env bash

# Create the priv/cert directory if it doesn't exist
if [ ! -d "priv/cert" ]; then
  mkdir -p priv/cert
fi

# Generate a new certificate
mkcert -key-file priv/cert/selfsigned_key.pem \
       -cert-file priv/cert/selfsigned.pem \
       localhost \
       zoonk.test "*.zoonk.test"

# Install the certificate in the system trust store
mkcert -install

# Check if dnsmasq is installed
if ! command -v dnsmasq &> /dev/null; then
  echo "dnsmasq not found. Installing..."
  brew install dnsmasq
else
  echo "dnsmasq is already installed."
fi

echo "Setting up dnsmasq for .test domains..."
mkdir -pv "$(brew --prefix)/etc/"
echo 'address=/zoonk.test/127.0.0.1' >> "$(brew --prefix)/etc/dnsmasq.conf"
echo 'address=/.zoonk.test/127.0.0.1' >> "$(brew --prefix)/etc/dnsmasq.conf"

sudo mkdir -v /etc/resolver
sudo bash -c 'echo "nameserver 127.0.0.1" > /etc/resolver/zoonk.test'

echo "Restarting dnsmasq..."
sudo brew services restart dnsmasq

echo "dnsmasq setup complete."

echo "Enable 'Allow invalid certificates for resources loaded from localhost' in Chrome at chrome://flags/#allow-insecure-localhost."
echo "Restart your local server (mix phx.server) and your browser if needed."
