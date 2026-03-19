# Database Phase 2.1 Changes

## Scope
This document describes the final database delta used by the voice-clone + voice-selection feature set.
It includes the Phase 2.1 introduction of `voice_profiles` and the follow-up direct character voice binding refactor (Phase 2.2).

Only changed tables/fields are listed.

---

## Change Summary

- Added table:
  - `voice_profiles`
- Modified table:
  - `characters`
- Removed field:
  - `characters.voice_profile_id` (no longer used for runtime binding)

---

## 1) Table Change: `characters`

### Field-level delta

| Field | Change Type | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- | --- |
| `voice_profile_id` | `REMOVED` | `uuid` | - | - | Removed FK-based voice binding. |
| `voice_provider` | `ADDED` | `varchar(40)` | `false` | `dashscope` | Voice provider key. |
| `voice_model` | `ADDED` | `varchar(120)` | `false` | `qwen3-tts-instruct-flash-realtime` | TTS model bound to character. |
| `voice_provider_voice_id` | `ADDED` | `varchar(191)` | `false` | `Cherry` | Provider-side voice ID/code. |
| `voice_source_type` | `ADDED` | `varchar(20)` | `false` | `system` | `system` / `clone` / `designed` / `imported`. |

### Added constraints / indexes

- Check constraint:
  - `characters_voice_source_type_check`
  - rule: `voice_source_type IN ('system','clone','designed','imported')`
- Index:
  - `characters_voice_binding_idx (voice_provider, voice_model, voice_provider_voice_id)`

### Data backfill

Existing `characters` rows are backfilled to:

- `voice_provider='dashscope'`
- `voice_model='qwen3-tts-instruct-flash-realtime'`
- `voice_provider_voice_id='Cherry'`
- `voice_source_type='system'`

---

## 2) New Table: `voice_profiles`

`voice_profiles` is the provider-agnostic persistence table for user custom voices (currently clone flow).
System voices are **not** sourced from this table at runtime.

### Field definition

| Field | Type | Nullable | Default / Constraint | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `false` | PK | Internal ID. |
| `owner_user_id` | `uuid` | `true` | FK `users.id` (`ON DELETE SET NULL`) | Voice owner (nullable after owner deletion). |
| `provider` | `varchar(40)` | `false` |  | Provider key (e.g. `dashscope`). |
| `provider_voice_id` | `varchar(191)` | `false` |  | Provider-side voice resource ID. |
| `source_type` | `varchar(20)` | `false` | Check constrained | Source category. |
| `status` | `varchar(20)` | `false` | Check constrained | Normalized lifecycle status. |
| `provider_status` | `varchar(40)` | `true` |  | Raw upstream status string. |
| `provider_model` | `varchar(120)` | `true` |  | Provider model used for this voice. |
| `display_name` | `varchar(80)` | `false` |  | UI display name. |
| `description` | `text` | `true` |  | Optional description. |
| `preview_audio_url` | `text` | `true` |  | Optional preview URL. |
| `language_tags` | `text[]` | `true` |  | Optional language/accent tags. |
| `metadata` | `jsonb` | `false` | default `'{}'::jsonb` | Extensible provider metadata. |
| `created_at` | `timestamptz` | `false` | default `now()` | Create time. |
| `updated_at` | `timestamptz` | `false` | default `now()` | Update time. |

### Constraints

- Unique:
  - `voice_profiles_provider_voice_uniq (provider, provider_voice_id)`
- Check:
  - `voice_profiles_source_type_check`
  - rule: `source_type IN ('system','clone','designed','imported')`
- Check:
  - `voice_profiles_status_check`
  - rule: `status IN ('creating','processing','ready','failed','deleting','deleted')`

### Indexes

- `voice_profiles_owner_user_created_at_idx (owner_user_id, created_at DESC)`
- `voice_profiles_provider_status_idx (provider, status)`

---

## 3) Runtime Source of Truth

- System voice catalog:
  - fetched from DashScope/Aliyun source at request time (not local DB seed)
- Clone voices:
  - persisted in `voice_profiles`
  - only user-owned, selectable, `ready` clone records are accepted for character binding

---

## 4) API Support Mapping

- `POST/PUT /v1/characters`:
  - backed by `characters.voice_provider`, `voice_model`, `voice_provider_voice_id`, `voice_source_type`
- `GET /v1/voices` and clone CRUD:
  - backed by `voice_profiles`
- `GET /v1/voices/catalog`:
  - system items from provider source + user clone items from `voice_profiles`
