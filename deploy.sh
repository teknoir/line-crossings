#!/usr/bin/env bash
set -eo pipefail
set -x

export BRANCH_NAME=${BRANCH_NAME:-"local"}
export SHORT_SHA=$(date +%Y%m%d-%H%M%S)
export IMAGE="us-docker.pkg.dev/teknoir/gcr.io/line-crossings"

docker buildx build \
  --platform=linux/amd64 \
  --push \
  --tag "${IMAGE}:${BRANCH_NAME}-${SHORT_SHA}" \
  .

export NAMESPACE=${NAMESPACE:-"demonstrations"}

if [[ $NAMESPACE == "demonstrations" ]] ; then
  export CONTEXT="gke_teknoir-poc_us-central1-c_teknoir-dev-cluster"
  export DOMAIN="teknoir.dev"
else
  export CONTEXT="gke_teknoir_us-central1-c_teknoir-cluster"
  export DOMAIN="teknoir.cloud"
fi

cat << EOF
---
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: line-crossings
  namespace: ${NAMESPACE}
spec:
  repo: https://teknoir.github.io/line-crossings
  chart: line-crossings
  targetNamespace: ${NAMESPACE}
  valuesContent: |-
    basePath: /${NAMESPACE}/line-crossings
    domain: ${DOMAIN}
    mediaServiceBaseUrl: https://${DOMAIN}/${NAMESPACE}/media-service/api

    image:
      repository: ${IMAGE}
      tag: ${BRANCH_NAME}-${SHORT_SHA}
EOF | kubectl --context $CONTEXT --namespace $NAMESPACE apply -f -
