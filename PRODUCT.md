# Product

## Register

product

## Users

- **Kültürel meraklılar** — Türkiye'nin bölgesel ağızlarını, deyimlerini keşfetmek isteyen okuyucular
- **Katkıda bulunanlar** — Kendi yörelerinin kelimelerini eklemek isteyen yerel halk
- **Moderatörler** — Gelen katkıları gözden geçiren topluluk üyeleri
- **Akademisyen / araştırmacılar** — Türk dili ve kültürü üzerine çalışan kişiler

Bağlam: Tarayıcıda, masaüstü ve mobil, haritayla etkileşim birincil eylem.

## Product Purpose

Türkiye'nin 81 iline ait yöresel kelime, deyim ve atasözlerini harita üzerinden keşfedilebilir, katkıda bulunulabilir ve aranabilir kılan kültürel arşiv. Wikipedia'nın derinliği, haritanın keşif keyfi, sosyal katkı döngüsünün büyümesi.

Başarı ölçütü: Kullanıcı 5 saniyede bir ile tıklar, 30 saniyede en az bir kelimeyi okur, topluluk katkısıyla her haftanın arşivi büyür.

## Brand Personality

**Sıcak · Köklü · Erişilebilir**
- Sıcak: Anadolu kültürel mirasına saygı
- Köklü: Akademik ciddiyet, TDK referansı, editoryal duruş
- Erişilebilir: Karmaşık bir konuyu harita + kelime kartlarıyla samimi kılmak

## Anti-references

- Generic SaaS dashboard görünümü (kart grid + ikon + heading + text tekrarı)
- AI-cream-trap (sıcak krem bg + tozlu kahve primary — her projede aynı)
- Steril harita UI'sı (Google Maps klonu, kurumsal gri tonları)
- Sidebar nav + 3-column layout (yönetim paneli estetiği)
- Eyebrow + numbered sections silsilesi (01 / 02 / 03)

## Design Principles

1. **Harita önce, harita her zaman** — Sayfa ne kadar gelişirse gelişsin, haritayı gizleme veya küçültme; o projenin kalbi.
2. **Editoryal tipografi** — Serif başlıklar (kültürel metin) + temiz sans (UI), gazete sayısı duruşu.
3. **Restrained color** — Doğal moss-yeşili primary, küçük doz; asıl sıcaklık tipografi ve imgelerden gelir.
4. **Tek seferde bir karar** — Bir ile tıklayınca liste değişir, başka hiçbir şey. Aynı anda 5 modal açılmaz.
5. **Katkıyı ödüllendir** — Yeni kelime eklemekten keyif alınacak kadar hızlı ve net olmalı.

## Accessibility & Inclusion

- WCAG AA minimum (body text ≥4.5:1, large text ≥3:1)
- Reduced motion: tüm animasyonlar `@media (prefers-reduced-motion: reduce)` ile yumuşatılır
- Klavye navigasyonu: harita etkileşimi klavye ile de çalışmalı
- Ekran okuyucu: entry kartları semantik yapıda (article + heading + content)