# Signova V1 — Namecheap Domain and DNS Setup

**Domain:** `<SIGNOVA_DOMAIN>` — not supplied yet.  
**Status:** blocked until the owner purchases the domain and provides access.

No domain was purchased and no DNS record was created during this audit.

---

## 1. Prerequisites

- The domain is registered at Namecheap.
- Namecheap remains the DNS provider (keep the default Namecheap BasicDNS
  nameservers unless there is a deliberate reason to change them).
- The three Netlify sites and the Render service already exist and show their
  custom-domain instructions.
- Existing DNS records (MX, SPF, DKIM, DMARC, verification TXT) have been
  inspected and preserved.

Do not change nameservers, email records, or unrelated A/CNAME records.

---

## 2. Records to create

The target values must come from the provider dashboards. They are not knowable
in advance and must not be guessed.

| # | Purpose | Type | Host / Name | Target / Value | TTL |
|---|---|---|---|---|---|
| 1 | Deaf-user PWA | CNAME | `app` | Exact target shown by Netlify for the `signova-app` site | 5 min (300 s) initially |
| 2 | Teller dashboard | CNAME | `teller` | Exact target shown by Netlify for the `signova-teller` site | 5 min |
| 3 | Administrator | CNAME | `admin` | Exact target shown by Netlify for the `signova-admin` site | 5 min |
| 4 | Backend API | CNAME | `api` | Exact target shown by Render for the web service | 5 min |

Where to obtain each target:

- **Netlify:** Site → Domain management → Add a domain → the pending DNS
  instructions show the CNAME target for a subdomain. For Netlify sites this is
  normally the site's `*.netlify.app` address, but use only the value Netlify
  displays for that site.
- **Render:** Service → Settings → Custom Domains → Add `api.<SIGNOVA_DOMAIN>` →
  Render displays the CNAME target (normally the service's `*.onrender.com`
  address). Use only the displayed value.

Namecheap entry details:

- Record type: `CNAME Record`
- Host: the label only (`app`, `teller`, `admin`, `api`), not the full domain.
- Value: paste the provider target **without** `https://` and without a trailing
  path or slash.
- TTL: `5 min` while verifying; `Automatic` or `30 min` afterwards is acceptable.
- Do not create both a CNAME and an A record for the same host.
- Do not create a wildcard `*` record during initial verification.

---

## 3. Procedure

1. Record the current DNS state (screenshot or export) before editing.
2. In Namecheap → Domain List → Manage → Advanced DNS, add record 1.
3. Return to Netlify and wait for verification. Do not add the next record until
   the first one is understood.
4. Repeat for records 2 and 3.
5. Add record 4 for Render.
6. Wait for both providers to report the domain/certificate as active.
7. Only then enable “Force HTTPS” / HTTPS redirect where offered.

If a provider asks for a TXT verification record, add it exactly as shown. Do not
replace or delete existing TXT records to “make room”.

---

## 4. HTTPS certificates

- Netlify provisions and renews Let's Encrypt certificates for each site.
- Render provisions and renews a certificate for its custom domain.
- No manual certificate upload is required or permitted.
- Certificates are only issued after public DNS resolves to the provider and the
  provider can complete its HTTP/TXT challenge.

Expected status sequence:

1. DNS record saved.
2. Provider shows “Awaiting DNS” / “Pending”.
3. Provider shows “Verified”.
4. Certificate status becomes “Issued” / “Active”.
5. `https://` returns a valid certificate with no warning.

If a certificate stays pending for more than 24–48 hours, re-check the exact
CNAME target and remove duplicate/conflicting records. Do not repeatedly delete
and recreate records.

---

## 5. Propagation behaviour

- TTL 300 s means resolvers may cache an old negative answer for 5 minutes.
- Global propagation commonly completes in 5–60 minutes; it can take up to 48
  hours in poor resolver conditions.
- Negative caching after a failed lookup can make a correct record appear broken
  for several minutes.
- Test with more than one resolver before changing anything.

Windows checks:

```powershell
Resolve-DnsName app.<SIGNOVA_DOMAIN> -Type CNAME -Server 1.1.1.1
Resolve-DnsName teller.<SIGNOVA_DOMAIN> -Type CNAME -Server 1.1.1.1
Resolve-DnsName admin.<SIGNOVA_DOMAIN> -Type CNAME -Server 1.1.1.1
Resolve-DnsName api.<SIGNOVA_DOMAIN> -Type CNAME -Server 1.1.1.1

nslookup app.<SIGNOVA_DOMAIN> 8.8.8.8
```

Public DNS check (optional, from a workstation):

```
https://dnschecker.org/#CNAME/app.<SIGNOVA_DOMAIN>
```

Certificate check:

```powershell
curl.exe -vI https://app.<SIGNOVA_DOMAIN>/ 2>&1 | Select-String "SSL certificate|subject|issuer|expire"
```

---

## 6. Verification checklist

| Check | Expected |
|---|---|
| `app` CNAME | Resolves to the exact Netlify target |
| `teller` CNAME | Resolves to the exact Netlify target |
| `admin` CNAME | Resolves to the exact Netlify target |
| `api` CNAME | Resolves to the exact Render target |
| HTTPS app | Valid certificate, no mixed content |
| HTTPS teller | Valid certificate |
| HTTPS admin | Valid certificate |
| HTTPS api | Valid certificate, `/api/health` reachable |
| Existing MX/SPF/DKIM records | Unchanged |
| Nameservers | Unchanged |

---

## 7. Rollback

If a host cannot validate:

1. Remove only the new CNAME for that host.
2. Wait for TTL expiry (5 minutes) before re-adding it.
3. Confirm the provider target again.
4. Do not delete the Netlify/Render site or the registered domain while
   debugging DNS.

---

## 8. Status

| Item | Status |
|---|---|
| Domain purchased | Not done |
| Namecheap access | Not provided |
| DNS records | Not created |
| Provider targets retrieved | Not available |
| HTTPS certificates | Not issued |
| Propagation | Not applicable yet |
