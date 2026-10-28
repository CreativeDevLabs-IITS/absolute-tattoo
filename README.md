# Absolute Tattoos & Body Piercing: website

Single-page, static redesign of absolutetattooshop.com ("Old School Soul, Future Ink").
Next.js 16 (App Router, static export) · Tailwind CSS v4 · GSAP + ScrollTrigger + SplitText · Lenis.

## Run

```bash
npm install
npm run dev                  # http://localhost:3000
npm run dev -- -H 0.0.0.0    # reachable from your phone on the same Wi-Fi
npm run build                # static site → dist/
npm run preview              # serve dist/ locally (gzip), like a real host
```

**Phone testing from WSL2:** WSL has its own IP, so the phone can't reach it directly. Either turn on
mirrored networking (`%UserProfile%\.wslconfig` → `[wsl2]` / `networkingMode=mirrored`, then `wsl --shutdown`)
and open `http://<your-PC-LAN-IP>:3000`, or forward the port from an admin PowerShell:
`netsh interface portproxy add v4tov4 listenport=3000 connectport=3000 connectaddress=$(wsl hostname -I)`
and allow port 3000 in Windows Firewall.

## Deploy to AWS Lightsail

These steps start **after you have cloned this repo on the Lightsail server** (as the `ubuntu` user, into `/var/www/absolute-tattoo`). Node.js and Nginx are set up for you by `sudo cpanel sites new`, so there is nothing to install by hand.

### 1. Build the site

```bash
cd /var/www/absolute-tattoo
npm ci
npm run build
```

The build downloads the site's Google fonts, so the server needs internet access while it runs. If this fails with `EACCES: permission denied`, see "If `npm run build` says permission denied" below.

This creates `/var/www/absolute-tattoo/dist`, the folder your domain will point at.

### 2. Create the site with `cpanel sites new`

```bash
sudo cpanel sites new
```

Answer the prompts like this (use your real domain):

| Prompt | Answer |
|--------|--------|
| Select application type | `4` (Static / React SPA) |
| Enter domain name | `example.com` |
| Enter site folder directory | `/var/www/absolute-tattoo/dist` |
| Apply secure ownership and permissions now? | `n` (so `ubuntu` can keep rebuilding). If you answer `y`, run `sudo chown -R ubuntu:ubuntu /var/www/absolute-tattoo` afterwards. |

The command writes the Nginx config for the domain (root set to the `dist` folder) and reloads Nginx.

### 3. Let Nginx serve the site's JavaScript (required for this site)

The `cpanel sites new` template only allows `.js` files under `/assets/` or `/static/`, and returns 404 for other file types. Next.js keeps its JavaScript in `/_next/static/`, and `robots.txt` and `sitemap.xml` are blocked too, so **without this step the page loads but has no animations, no menu and hidden sections**. Run once per domain:

```bash
cd /var/www/absolute-tattoo
sudo bash deploy/fix-nginx.sh example.com
```

See "If the site loads but animations or pages are missing" below for details.

### 4. Open the firewall in Lightsail

In the Lightsail console, open your instance, then **Networking**, then **IPv4 Firewall**. Make sure these rules exist: **HTTP (TCP 80)** and **HTTPS (TCP 443)**. Add the same rules under the IPv6 firewall if you use IPv6.

### 5. Point your domain at the server

1. In Lightsail, open **Networking**, then **Create static IP**, and attach it to the instance. Without this, the IP changes whenever the instance restarts.
2. At your domain registrar (or in the Lightsail DNS zone), create these records pointing to the static IP:

   | Type | Name | Value |
   |------|------|-------|
   | A | `@` | your static IP |
   | A | `www` | your static IP |

3. Wait for DNS to propagate (usually a few minutes, sometimes up to an hour). Check with `dig +short example.com`.

### 6. Check HTTPS

`cpanel sites new` sets up the HTTPS certificate for the domain. Once DNS points at the server, open `https://example.com`. If the browser shows no padlock or a certificate warning, get a certificate with Certbot:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

### If this domain was already set up with the old `out/` folder

Earlier versions of this repo built into `out/`, and the server site for this domain may still point at `/var/www/absolute-tattoo/out`. After the first build with this version, change its Nginx root to `dist` (replace the domain with yours):

```bash
cd /
sudo grep -n "root " /etc/nginx/sites-enabled/example.com
sudo cp /etc/nginx/sites-enabled/example.com /root/example.com.nginx.bak
sudo sed -i 's#root /var/www/absolute-tattoo/out;#root /var/www/absolute-tattoo/dist;#' /etc/nginx/sites-enabled/example.com
sudo nginx -t 2>&1 | tail -2 && sudo systemctl reload nginx
```

`sudo cpanel sites` may keep showing the old root, because the tool keeps its own record. What Nginx serves comes from the config file.

## Updating the site

After you push changes to GitHub, run this on the server:

```bash
cd /var/www/absolute-tattoo
git pull
npm ci
npm run build
```

Nginx serves the files straight from `dist`, so there is nothing to restart. Run these from the repo folder, not from inside `dist/`.

## If `npm run build` says "permission denied" (EACCES)

```
Error: EACCES: permission denied, mkdir '/var/www/absolute-tattoo/dist'
```

The build has to create a fresh `dist/` folder inside the repo folder, so the user running it (`ubuntu`) must own that folder. It does not when the repo was cloned with `sudo`, or when the `cpanel sites new` tool's "Apply secure ownership and permissions now?" prompt was answered `y` (that hands the folder to another user). Nginx does not need ownership, only read access, so giving the folder to `ubuntu` is safe:

```bash
ls -ld /var/www/absolute-tattoo /var/www/absolute-tattoo/dist      # shows who owns the folder (should say ubuntu)
sudo chown -R ubuntu:ubuntu /var/www/absolute-tattoo
cd /var/www/absolute-tattoo
npm ci
npm run build
```

The fix is per folder, so run it once for every site on the server. To fix several at once (change the names to match your folders; it is safe to run again on sites that are already fixed):

```bash
for s in absolute-tattoo dl-animal stjohn-vet animalhealth-center proactive-therapy bestfit-tailor kidderstreet-drycleaners deluxe-drycleaners littlebears-childcare; do
  [ -d /var/www/$s ] && sudo chown -R ubuntu:ubuntu /var/www/$s && echo "fixed $s"
done
```

If the error comes back later, something changed the ownership again (usually answering `y` to the `cpanel sites new` secure-ownership prompt, or running `git pull` or the build with `sudo`). Run the `chown` again, and check `ls -ld /var/www/absolute-tattoo` straight afterwards to see who owns it.

Tips:

- Clone as `ubuntu` (no `sudo`). If `/var/www` is not writable, create the folder once with `sudo mkdir /var/www/absolute-tattoo && sudo chown ubuntu:ubuntu /var/www/absolute-tattoo` and then clone into it.
- If `cpanel sites new` offers to apply secure ownership and permissions, answer `n`, or run the `chown` above straight after it finishes.
- Run `npm run build` from the repo folder, not from inside `dist/`. The build replaces `dist/`, which leaves a shell that is sitting inside it pointing at a deleted folder.

## If the site loads but animations or pages are missing (`cpanel sites new`)

Sites created with the server's `cpanel sites new` tool (Static / React SPA) get an Nginx config that only allows `.js` files under `/assets/` or `/static/`, and returns **404 for every other file extension**. This site's JavaScript lives in `/_next/static/`, so the template blocks it: the page shows only the plain HTML, with no animations, no menu and hidden sections. `robots.txt` and `sitemap.xml` are blocked as well. Fix it once per site on the server from the repo folder (replace the domain with yours):

```bash
cd /var/www/absolute-tattoo
sudo bash deploy/fix-nginx.sh example.com
```

The script backs up the Nginx config (to `/root/example.com.nginx.bak`), adds rules that allow `.js`, `.mjs`, `.html`, `.txt`, `.xml`, `.json`, `.pdf`, `.xlsx`, `.docx` and a few media files, tests the config, and reloads Nginx. If the test fails it puts the backup back. Running it twice is harmless.

Afterwards hard-refresh the site (Ctrl+Shift+R), and if the domain is behind Cloudflare, purge its cache (Caching, then Purge Everything). If you run `cpanel sites new` again for the same domain, it rewrites the config, so run the script again.

To check it worked, open the site with the browser's developer tools (F12) and look at the Console: there should be no red 404 errors for `/_next/static/...` files.

## Troubleshooting

- **`npm run build` fails with `EACCES: permission denied`:** the repo folder is not owned by `ubuntu`. See "If `npm run build` says permission denied" above and run `sudo chown -R ubuntu:ubuntu` on the repo folder.
- **Page loads but animations do not run, or `/_next/static/...` files return 404:** run `deploy/fix-nginx.sh` (step 3).
- **`npm run build` prints `Killed`:** the server ran out of memory. Add swap (for example `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) and run the build again.
- **403 Forbidden:** Nginx cannot read the files. Run `sudo chmod -R o+rX /var/www/absolute-tattoo/dist`, and make sure the folders above it are readable (`ls -ld /var/www /var/www/absolute-tattoo`).
- **Default Nginx welcome page shows:** the domain has no site yet. Run `sudo cpanel sites new` for it (step 2).
- **Site not loading on the domain:** check the DNS records, the Lightsail firewall ports (80 and 443), and `sudo nginx -t`.
- **Changes not showing:** run `npm run build` again and hard-refresh the browser (Ctrl+Shift+R). Static files are cached for 30 days.
- **Logs:** `sudo tail -f /var/log/nginx/error.log`

## Content

All copy and shop facts live in `src/data/content.ts`: phone, address, story, services, process, gallery
order, alt text and frame sizes. Years in business are always computed from 1994. Update `shop.siteUrl` in that file if the domain changes (canonical URL, Open Graph, sitemap and JSON-LD use it; it is currently `https://absolutetattooshop.com`).

## Images

Gallery photos are the client's own, pulled from the old site's originals (`Image=o`, never the upscaled `Image=l`).

```bash
npm run images:fetch      # re-download originals → public/images/{tattoos,piercings}
npm run images:optimize   # AVIF + WebP at 480/720/960/1600 (never upscaled) + logo downscales
npm run images:og         # Open Graph image + app icons
```

`public/logo.png` is the untouched original. `logo-*.webp` are proportional downscales of it, used for speed.

## Structure

```
src/app/                  layout (fonts, metadata, pre-paint script), page (sections + JSON-LD), robots, sitemap
src/components/sections/  Hero, Story, Services, CleanCertified, TattooGallery, PiercingGallery, Process, Contact, Footer
src/components/ui/        Navbar, MenuOverlay, MobileActionBar, Preloader, Cursor, MagneticButton, RevealText,
                          RevealImage, InkMask, DrawLine, Lightbox, GalleryFrame, Picture, Logo
src/components/providers/ SmoothScroll (Lenis ↔ GSAP ticker ↔ ScrollTrigger)
src/hooks/                media queries, reduced motion, scroll lock, focus trap, current year, gallery reveal
src/lib/                  gsap registration, motion tokens, images, intro handshake, scroll helper
scripts/                  image fetch / optimize / OG generation
```

## Notes

- **Static export:** `next.config.ts` uses `output: "export"` and `distDir: "dist"`, so `npm run build` writes the finished site to `dist/`. Server features (API routes, server actions, middleware) cannot be used with this setup.
- **Next.js version:** `next` is pinned to 16.4.3. Versions 16.0.0 to 16.4.0 have critical security advisories, and `next build` stops with an error on them.
