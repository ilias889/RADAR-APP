-- ============================================================
-- قاعدة بيانات تطبيق رادار — نفّذ هذا الملف كاملاً في:
-- Supabase Dashboard → SQL Editor → New query → الصق والصق ثم Run
-- ============================================================

-- تفعيل توليد UUID تلقائياً
create extension if not exists "pgcrypto";

-- ---------- جدول البلاغات (مشترك بين الجميع) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  type text not null check (type in ('fake_order','repeated_refusal','wrong_address','abuse')),
  details text default '',
  reporter text not null default 'مجهول',
  reporter_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reports_phone_idx on public.reports (phone);
create index if not exists reports_reporter_user_idx on public.reports (reporter_user_id);

alter table public.reports enable row level security;

-- أي شخص (حتى بدون تسجيل دخول) يقدر يقرأ البلاغات — مطلوب لخاصية البحث العامة
create policy "reports_public_select" on public.reports
  for select using (true);

-- أي شخص يقدر يضيف بلاغ (بما فيهم الزوار غير المسجّلين، مطابقة لتطبيق البحث السريع)
-- ملاحظة أمان: قبل إطلاق حقيقي، يُنصح بتقييد هذا بمستخدمين مسجّلين أو بإضافة تحقق CAPTCHA
-- لمنع إغراق الجدول ببلاغات آلية كيدية.
create policy "reports_public_insert" on public.reports
  for insert with check (true);

-- الحذف والتعديل مسموح للمسؤول (profiles.is_admin = true) أو لصاحب البلاغ نفسه
create policy "reports_admin_delete" on public.reports
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "reports_owner_delete" on public.reports
  for delete using (auth.uid() = reporter_user_id);

create policy "reports_admin_update" on public.reports
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "reports_owner_update" on public.reports
  for update using (auth.uid() = reporter_user_id);

-- ---------- جدول ملفات التجار (مرتبط بنظام تسجيل الدخول من Supabase Auth) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- كل مستخدم يقدر يقرأ ويعدّل ملفه الشخصي فقط
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ---------- دالة تلقائية: إنشاء صف profile عند تسجيل مستخدم جديد ----------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, store_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'store_name', 'متجر بدون اسم'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- بعد تنفيذ هذا الملف:
-- 1) سجّل حساب تاجر عادي من داخل التطبيق (تبويب "لوحتي" → حساب جديد).
-- 2) ارجع هنا ونفّذ السطر التالي لجعل ذلك الحساب مسؤولاً (بدّل البريد):
--
--    update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'ضع_بريدك_هنا@example.com');
--
-- 3) سجّل دخولك بنفس الحساب من تبويب "الإدارة" داخل التطبيق.
-- ============================================================
