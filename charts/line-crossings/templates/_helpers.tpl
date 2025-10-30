{{- define "line-crossings.full-base-path" -}}
{{- printf "/%s/%s" (.Release.Namespace) (trimPrefix "/" (trimSuffix "/" .Values.basePath)) -}}
{{- end -}}
