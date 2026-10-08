# Moving off Xplan

This guide brings your client list across from Xplan in an afternoon, and is honest about what
takes longer. Run both systems side by side until you trust this one.

## 1. Export the client list from Xplan

Xplan exports the client search list to CSV with whatever columns you have configured on it, as
described in the Iress community:

1. Open the client search list.
2. Click the preferences icon at the top corner of the result and choose **temp table config**.
3. Tick the columns you want. The import reads these by default:

   | This system | Xplan column (any of these headings) |
   |---|---|
   | source id (required) | Client ID, Entity ID, Xplan ID, ID |
   | name (required) | Client Name, Name, Full Name, Entity Name |
   | adviser | Adviser, Primary Adviser, Adviser Name |
   | status | Client Status, Status |
   | service package | Service Package, Service Level, Client Category, Category |
   | last review | Last Review Date, Last Review |
   | client since | Client Since, Start Date, Date Joined |
   | email | Email, Email Address, Preferred Email |
   | phone | Mobile, Mobile Phone, Phone, Preferred Phone |

4. **Save Current Config**, then **Save**, then click **CSV**.

If a field you need is not offered, your site administrator may have to add it at the system
settings level. Some sites restrict exports by role: ask your administrator or licensee.

Your headings are different? Write a map and pass it with `--map`:

```json
{ "source_id": "Ref", "name": "Household", "adviser": "Owner" }
```

## 2. Dry run, then import

```bash
npm run advice -- import xplan --file=client-list.csv --dry-run --actor="Your Name"
npm run advice -- import xplan --file=client-list.csv --actor="Your Name"
```

Add `--jurisdiction=NZ` for a New Zealand book. Dates can be `DD/MM/YYYY` or `YYYY-MM-DD`.

- Each client gets the reference `X-<Xplan id>` and keeps every original column on the record, so
  nothing in the export is lost even where it has no field here.
- Statuses map: Client, Active and Current to active; Prospect and Lead to prospect; Inactive,
  Ceased, Lost, Former and Deceased to ceased. Anything else stops the import and names the row.
- An adviser not yet in the database is added from their name, with their initials as the code.
- Running the same file again changes nothing. If a client's row has changed in Xplan since the
  last import, the import stops and asks you to reconcile that client by hand.

## 3. What the client list does not carry

| Record | How to bring it |
|---|---|
| Ongoing fee arrangements and consents | One `add-arrangement` per arrangement, from your fee register or platform fee report. Set `--reference-day` to the current reference day, so the consent window is right from day one. |
| Advice files in progress | `add-advice` for the files that are open today. Finished advice stays in Xplan's document store or your archive. |
| File notes and documents | Iress support exports these on request (raise it through the Iress Connect Portal; your licensee or site administrator may need to ask). Xmerge can extract file note attachments. Keep them in your document store; link the location in a file note. |
| Holdings, modelling, research data | Not stored here. See `docs/why-no-front-end.md`. |
| Complaints register, CPD | From your existing registers, with `add-complaint` and `add-cpd`. |

A full database extract from Iress (usually delivered as a database backup through a secure server)
carries everything, including file notes. Mapping that extract is part of what Enterprise DNA does
when it installs this for a practice.

## 4. Run side by side

For one review cycle, run `/reviews-due` and `/consents-due` here and compare them with Xplan's
review and fee reports. Fix any client whose dates disagree. When the two match for a month, stop
entering in Xplan.

## 5. Before you cancel Xplan

Iress agreements usually renew annually and need notice before the renewal date: check your own
agreement for the notice period. Ask for the full extract well before it, and keep it with your
records for as long as your record-keeping obligations require.
