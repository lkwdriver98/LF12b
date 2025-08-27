#!/usr/bin/env bash
# TechFlair MicroK8s Bootstrap
# Purpose: Prepare a server node for MicroK8s, enable core add-ons, and configure kubectl.
# Works on Ubuntu Server 20.04/22.04/24.04 (root or sudo required).

set -euo pipefail

# --- safety & helpers ---
if [[ $EUID -ne 0 ]]; then
  echo "[!] Please run as root (use: sudo bash project/scripts/bootstrap.sh)"
  exit 1
fi

log() { printf "\n[+] %s\n" "$*"; }

# --- system prep (optional but recommended) ---
log "Updating apt packages"
apt-get update -y
apt-get upgrade -y

# Disable swap for Kubernetes (recommended)
if swapon --show | grep -q .; then
  log "Disabling swap"
  swapoff -a || true
  sed -i.bak '/\sswap\s/s/^/#/' /etc/fstab || true
fi

# --- install microk8s (snap) ---
if ! snap list | grep -q '^microk8s\b'; then
  log "Installing MicroK8s (latest/stable)"
  snap install microk8s --classic --channel=1.29/stable
else
  log "MicroK8s already installed"
fi

# Ensure the default user can run microk8s/kubectl without sudo
DEFAULT_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "ubuntu")}"
usermod -aG microk8s "$DEFAULT_USER"
mkdir -p "/home/${DEFAULT_USER}/.kube"
chown -R "${DEFAULT_USER}:${DEFAULT_USER}" "/home/${DEFAULT_USER}/.kube"

# --- wait for microk8s ready ---
log "Waiting for MicroK8s to become ready (this may take a few minutes)"
microk8s status --wait-ready

# --- enable essential add-ons ---
log "Enabling DNS and Ingress add-ons"
microk8s enable dns
microk8s enable ingress

# (optional) local image registry
# microk8s enable registry

# --- kubeconfig for kubectl ---
log "Exporting kubeconfig to user's home (~/.kube/config)"
microk8s config > "/home/${DEFAULT_USER}/.kube/config"
chown "${DEFAULT_USER}:${DEFAULT_USER}" "/home/${DEFAULT_USER}/.kube/config"
chmod 600 "/home/${DEFAULT_USER}/.kube/config"

# --- convenience: alias kubectl ---
if ! command -v kubectl >/dev/null 2>&1; then
  snap alias microk8s.kubectl kubectl || true
fi

# --- cluster hints ---
log "Basic checks:"
kubectl get nodes
kubectl get all -A | head -n 20 || true

cat <<'EOF'

Next steps:
1) On the control-plane node (this node), to add workers, run:
     microk8s add-node
   Copy the 'microk8s join ...' command and execute it on each worker node (as root).

2) Deploy the demo NGINX app:
     kubectl apply -f project/k8s/deploy-nginx.yaml
     kubectl apply -f project/k8s/service.yaml
     kubectl apply -f project/k8s/ingress.yaml

3) Verify:
     kubectl get pods -n web
     kubectl get svc -n web
     kubectl get ingress -n web

4) Test via Ingress (adjust host mapping if needed):
   - Add to your local /etc/hosts:  <MASTER_NODE_IP>  nginx.local
   - Open: http://nginx.local/
EOF

log "Bootstrap finished."
