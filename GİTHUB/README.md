# Gelişmiş Kişisel Bulut

Vercel + Next.js App Router + Supabase Database/Storage ile geliştirilmiş çok
kullanıcılı kişisel bulut sistemi.

## Özellikler

- `admin` ve `user` rolleri
- Admin panelinden kullanıcı adı, şifre ve rol ile yeni kullanıcı oluşturma
- Admin panelinden kullanıcı silme, rol ve şifre değiştirme
- Şifrelerin sunucuda bcrypt ile hash'lenmesi
- Normal kullanıcının yalnızca kendi dosya ve klasörlerine erişmesi
- Adminin tüm kullanıcıları ve dosyaları görebilmesi
- Klasör oluşturma, klasör içinde gezinme ve klasöre yükleme
- Çoklu dosya yükleme ve sürükle-bırak
- ZIP, RAR, PDF, Word, Excel, görsel, TXT ve diğer tüm dosya türleri
- Dosya/klasör arama, yeniden adlandırma ve silme
- Özel bucket için süreli indirme bağlantıları
- IP, user-agent, cihaz, tarih ve kullanıcı içeren işlem logları
- Başarılı/başarısız giriş ve oturum geçmişi
- Supabase tabanlı dağıtık giriş rate limit: 15 dakikada 5 başarısız deneme
- Mobil uyumlu modern siyah arayüz

## Güvenlik mimarisi

- Parolalar yalnızca bcrypt hash olarak `users` tablosunda tutulur.
- Oturum çerezinde kullanıcı bilgisi değil, 48 bayt rastgele opak belirteç
  bulunur. Veritabanında yalnızca HMAC-SHA256 belirteç özeti saklanır.
- Çerez `HttpOnly`, `SameSite=Strict` ve üretimde `Secure` özelliklidir.
- Her dosya ve admin API rotası oturumu, rolü ve dosya sahipliğini yeniden
  doğrular.
- `SUPABASE_SERVICE_ROLE_KEY` yalnızca server component/route handler
  dosyalarında kullanılır ve tarayıcıya gönderilmez.
- Mutasyon isteklerinde Origin doğrulaması yapılır.
- Bucket private'tır; public Storage politikası oluşturulmaz.

## 1. Supabase kurulumu

1. [Supabase Dashboard](https://supabase.com/dashboard) üzerinden proje oluşturun.
2. **SQL Editor → New query** ekranını açın.
3. Projedeki `supabase/schema.sql` dosyasının tamamını yapıştırıp **Run** deyin.
4. SQL; `users`, `files`, `activity_logs`, `sessions` tablolarını, indeksleri,
   trigger'ları ve private `personal-files` bucket'ını oluşturur.

### Supabase SQL tabloları

Tam ve doğrudan çalıştırılabilir sürüm `supabase/schema.sql` içindedir. Temel
tablolar:

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.files(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('file', 'folder')),
  storage_path text unique,
  mime_type text,
  size bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  username text,
  action text not null,
  file_name text,
  file_path text,
  ip_address text,
  user_agent text,
  device_info text,
  success boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  ip_address text,
  user_agent text,
  device_info text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
```

Şema RLS'yi bütün tablolarda etkinleştirir ancak anon/public politika eklemez.
Sunucu tarafındaki Service Role Key bu tablolara erişir. Supabase, Service Role
Key'in RLS'yi aştığını belirttiği için anahtarı kesinlikle istemciye koymayın:
[Supabase Storage erişim kontrolü](https://supabase.com/docs/guides/storage/security/access-control).

## 2. İlk admin hesabı

İlk başarılı girişte, `ADMIN_USERNAME` adlı kullanıcı veritabanında yoksa
uygulama bu kullanıcıyı `ADMIN_PASSWORD_HASH` ile `admin` rolünde oluşturur.
Sonraki kullanıcılar web admin panelinden eklenir.

Admin parola özeti:

```bash
npm run hash-password -- "en-az-12-karakterlik-guclu-sifre"
```

Session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Lokal kurulum

Node.js 20.9 veya daha yeni gereklidir.

```bash
npm install
```

```powershell
Copy-Item .env.local.example .env.local
```

macOS/Linux:

```bash
cp .env.local.example .env.local
```

`.env.local`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt çıktısı>
SESSION_SECRET=<en az 32 karakterlik rastgele değer>
NEXT_PUBLIC_SUPABASE_URL=https://PROJE_KODUNUZ.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret service role key>
SUPABASE_BUCKET=personal-files
```

```bash
npm run dev
```

Adres: `http://localhost:3000`

## 4. Admin paneli

Admin ile giriş yaptıktan sonra üst menüden **Admin paneli** bağlantısını açın.

- **Yeni kullanıcı:** Kullanıcı adı, düz metin şifre ve `admin/user` rolü girilir.
  Şifre API rotasında bcrypt ile hash'lenir; düz metin veritabanına yazılmaz.
- **Şifre değiştir:** Yeni şifre hash'lenir ve kullanıcının açık oturumları
  kapatılır.
- **Kullanıcı sil:** Kullanıcının Storage nesneleri, dosya kayıtları ve
  oturumları temizlenir.
- **Son işlemler:** Yükleme, silme, indirme, klasör işlemleri, kullanıcı
  yönetimi ve girişler görünür.
- **Oturum geçmişi:** IP, cihaz, tarayıcı, başlangıç, son kullanım ve durum
  görünür.

## 5. GitHub'a yükleme

```bash
git init
git add .
git commit -m "Gelişmiş kişisel bulut"
git branch -M main
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main
```

`.env.local`, `.next`, `.vercel` ve `node_modules` `.gitignore` kapsamındadır.

## 6. Vercel'e deploy

1. [Vercel New Project](https://vercel.com/new) ekranından GitHub reposunu seçin.
2. Framework Preset: **Next.js**
3. Build Command:

   ```text
   npm install && npm run build
   ```

4. Output Directory ve Start Command: **Next.js default**
5. Aşağıdaki Environment Variables değerlerini Production için ekleyin:

   ```text
   ADMIN_USERNAME
   ADMIN_PASSWORD_HASH
   SESSION_SECRET
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   SUPABASE_BUCKET
   ```

6. Deploy edin. Değişken değişikliklerinden sonra yeniden deploy gerekir.

Vercel Function istek gövdesi sınırı nedeniyle dosya verisi Next.js API
rotasından geçirilmez. API yalnızca kısa ömürlü imzalı yükleme URL'si oluşturur;
tarayıcı dosyayı doğrudan Supabase Storage'a gönderir. Vercel'in güncel payload
sınırı için [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
belgesine bakın.

## Dosya boyutu

Uygulama dosya başına 2 GB üst sınır uygular. Supabase projenizdeki global veya
bucket limiti daha düşükse geçerli olan düşük limittir. Çok büyük dosyalarda
Supabase TUS/resumable upload daha dayanıklıdır; bu sürüm çoklu standart imzalı
yükleme kullanır.

## Komutlar

```bash
npm run dev
npm run build
npm start
npm run hash-password -- "guclu-sifre"
npm run check
```
