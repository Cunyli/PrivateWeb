Subject: Non-destructive PostGIS schema relocation to resolve managed-object security advisories

Project ref: ncytmmujlnhscchfujkc
Postgres: 15.14.1.004
Installed PostGIS: 3.3.7, public schema, owned by supabase_admin, non-relocatable.

Please use the documented Supabase Support procedure to relocate PostGIS from public to extensions without dropping dependent data, and rebind its internal schema-qualified references through the supported extension update procedure.

Documentation:
https://supabase.com/docs/guides/database/extensions/postgis#moving-postgis-to-a-different-schema

The project's postgres role is neither superuser nor a member of supabase_admin. It cannot revoke the inherited PUBLIC / anon / authenticated EXECUTE grants on the three SECURITY DEFINER overloads of public.st_estimatedextent. A rolled-back grant probe confirmed that those grants remain effective.

Current related security advisories:
- RLS disabled on public.spatial_ref_sys (the PostGIS coordinate reference table).
- PostGIS extension installed in public.
- st_estimatedextent(text,text), st_estimatedextent(text,text,text), and st_estimatedextent(text,text,text,boolean) executable by anon and authenticated (six advisories).

Mitigation already prepared/applied in this security pass: anonymous/authenticated Data API requests are restricted to the application's public content tables and a small set of read-only application RPCs. Direct requests to the PostGIS functions and extension tables are blocked. The application does not expose Supabase Realtime or Storage for these extension objects. Core portfolio RLS and write grants have been tightened independently.

Please preserve public.locations geometry data and the existing application functions/views. The custom geographic functions already use search_path public, extensions. Please verify those map queries and the published-photo query after relocation. Please do not DROP EXTENSION ... CASCADE, reset the database, rotate JWT secrets, or modify user content as part of this request.

No credentials, access tokens, customer records, or image originals are included in this request.
