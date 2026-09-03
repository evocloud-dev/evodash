# Publishing apps to App Endpoints

App Endpoints fills itself from the cluster. There are two ways in, and the
page shows both together.

| | Annotation | Custom resource |
|---|---|---|
| What you edit | The Ingress/HTTPRoute you already have | A separate `AppEndpoint` object |
| Needs installing | Nothing | `crds/appendpoint-crd.yaml`, once per cluster |
| Best for | Anything already served by a route | Apps with no route to annotate |
| Example | `annotated-httproute.yaml`, `annotated-ingress.yaml` | `app-endpoint.yaml` |

Annotations need nothing installed at all, so start there. Reach for the
custom resource when an app has no Ingress or HTTPRoute to hang an annotation
on — an external service, something behind a Gateway you do not own, or a link
that is not a cluster workload.

## Steps

1. **Start the cluster and Headlamp.**

   ```bash
   minikube start
   ```

   ```bash
   npm start
   ```

   Run `npm start` from the Headlamp repo root. It brings up the backend on
   `:4466` and the frontend on `:3000`.

2. **Open the page** at <http://localhost:3000> → **EvoCloud** → **App
   Endpoints**. With nothing published it says *No applications published yet*.

3. **Publish an app.**

   ```bash
   kubectl apply -f examples/annotated-httproute.yaml
   ```

   No standalone `kubectl` on this machine — minikube ships its own, so use
   `minikube kubectl -- apply -f …` (note the `--`) for every command below.

   The card appears within a second or two — the page watches the cluster over
   Headlamp's websocket, so there is nothing to refresh.

4. **Remove it again** when you are done.

   ```bash
   kubectl delete -f examples/annotated-httproute.yaml
   ```

If you changed the plugin's own code, rebuild before step 2 — and note that
Headlamp serves `main.js` from the plugin root, not `dist/`:

```bash
npm run build && cp dist/main.js main.js
```

Then hard-reload the browser (Ctrl+Shift+R) so the old bundle is not served
from cache.

## The annotations

Written on any `Ingress` or `HTTPRoute`. Only `expose` is required.

| Annotation | Default | Notes |
|---|---|---|
| `evocloud.dev/expose` | — | **Required.** `"true"`, or the resource is ignored |
| `evocloud.dev/appName` | resource name | Display name |
| `evocloud.dev/group` | namespace | Group heading on the page |
| `evocloud.dev/icon` | none | Absolute URL of an image |
| `evocloud.dev/instance` | none | Shown in the Instance column |
| `evocloud.dev/url` | derived | Overrides the derived URL; must carry a scheme |
| `evocloud.dev/properties` | none | Comma-separated `key:value` pairs, **not JSON** |
| `evocloud.dev/network-restricted` | `false` | `"true"` shows the padlock and the *Internal* pill |

### Where the URL comes from

- **Ingress** — the first rule's host, `https` when the Ingress declares TLS,
  otherwise `http`.
- **HTTPRoute** — the first entry in `spec.hostnames`, assumed `https`. An
  HTTPRoute names hosts but not scheme (TLS is declared on the Gateway
  listener, a separate object), so use `evocloud.dev/url` to say otherwise.

A resource with no host at all still appears, with its link marked *no url* —
it is published but unreachable, which is worth seeing rather than hiding.

### Upgrading from the upstream namespace

Annotations in the older `forecastle.stakater.com/…` namespace are still read,
so nothing already deployed drops off the page. Where a resource carries both,
the `evocloud.dev` one wins — you can rename or regroup an app by adding the
new annotation without stripping the old one first.

## Custom resources

Install the CRD once, then create `AppEndpoint` objects:

```bash
kubectl apply -f crds/appendpoint-crd.yaml
```

```bash
kubectl apply -f examples/app-endpoint.yaml
```

There is no controller and nothing to run — the catalog reads the objects
directly, so the CRD on its own is the whole install. Until it is applied the
API returns 404 for this kind, which the page treats as "this source is not
present" rather than as an error, so the annotation apps still show.

`spec.name` and `spec.group` are required; the API server rejects an object
missing either. The rest mirrors the annotations: `icon`, `url`, `instance`,
`networkRestricted`, `properties` (a real map here, not a comma-separated
string), plus `urlFrom` for taking the URL from another resource.

Check them with kubectl:

```bash
kubectl get appendpoints -A
```

### Precedence

Three sources can describe the same app while something is being migrated. The
first one to describe it wins, in this order:

1. `AppEndpoint` — the catalog's own resource
2. The legacy upstream kind, where a cluster still has those objects
3. An annotation on an Ingress or HTTPRoute

So an app never appears twice, and adding an `AppEndpoint` is enough to
override how an annotated route describes it.

Each card and row shows a **Source** chip — `Resource`, `Ingress` or
`HTTPRoute` — saying which mechanism put it there, because the three are
edited in completely different places.
