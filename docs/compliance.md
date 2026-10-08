# The rules an advice practice lives under

This file is the rule book `/compliance` checks the database against. Each rule has a code, the
source it comes from, what a breach looks like in the data, and the command that fixes it.
`npm run advice -- compliance` runs all of them; the checks live in the `compliance_findings`
view in `supabase/migrations/0001_advice.sql`.

Nothing here is legal advice. These are the rules the practice has told this system to enforce.
Read them, change them to match your licensee's policies and your own licence, and keep the
sources current. When a rule changes, change the rule here and the check in the view together
(`/customise` does both).

Australian rules come from the Corporations Act 2001, the Corporations Regulations 2001 and ASIC
guidance. New Zealand rules come from the Financial Markets Conduct Act 2013 as amended by the
Financial Services Legislation Amendment Act 2019, the Financial Markets Conduct Regulations 2014,
the standard conditions of a financial advice provider licence, and the Code of Professional
Conduct for Financial Advice Services. A code starting `POLICY-` is a practice rule with a default
this system picked: it is not the law, and you should set it to your own.

## What this system does not do

- **It does not move money.** No fee deductions, no platform instructions, no client money. When an
  arrangement ends, the file note says to tell the platform to stop the fee; a person does that.
- **It does not write the statement of advice.** It tracks the advice file through its stages and
  holds the scope and the reasons. The document itself is written in your licensee's template.
- **It does not model.** No cash-flow projections, no Centrelink or tax calculations, no research or
  platform data feeds. Those are what Enterprise DNA connects for a practice that wants them.

---

## AU-OFA-LAPSED: no consent inside the window, the arrangement has ended

**Source.** Corporations Act 2001 section 962F: an ongoing fee arrangement terminates if the client
has not given written consent to renew it within the period set by section 962H. Since the
Treasury Laws Amendment (Delivering Better Financial Outcomes and Other Measures) Act 2024, that
period runs from 60 days before the reference day to 150 days after it, for arrangements from
their first anniversary after 10 January 2025. ASIC INFO 286, questions 12, 13 and 15:
[asic.gov.au](https://www.asic.gov.au/regulatory-resources/financial-services/giving-financial-product-advice/fees/faqs-ongoing-fee-arrangements-and-consents).

**Breach in the data.** An active AU arrangement where today is more than 150 days past
`next_reference_day` and no consent has rolled it forward.

**Fix.** Stop the fee with the platform. `end-arrangement --reason="No consent within the window"`.
If the client wants to continue, they sign a new arrangement (`add-arrangement`). Never back-date a
consent.

## AU-OFA-WINDOW: the consent window closes inside 45 days

**Source.** As above, section 962H and ASIC INFO 286 question 12. Forty-five days is this system's
warning band, so the form goes out with time to chase it.

**Breach in the data.** An open window with 45 days or fewer left and no consent signed since it
opened.

**Fix.** `/draft-consent`, then `record-consent` once it is signed.

## AU-OFA-CONTENT: the latest consent is missing what it must contain

**Source.** Corporations Act 2001 section 962G (written consent, signed and dated, kept by the fee
recipient) and the content the Delivering Better Financial Outcomes Act 2024 requires of a consent:
the services the client is entitled to in the coming period, the accounts the fees are deducted
from, and the date the arrangement terminates if consent is not given. The annual fee disclosure
statement was removed by the same Act. Corporations Regulations 2001 regulation 7.7A.11AA(2) says
which consent records to keep. ASIC INFO 286, linked above.

**Breach in the data.** The most recent consent on an active AU arrangement with
`services_listed`, `accounts_listed` or `termination_date_stated` false.

**Fix.** Check the signed form. If it really is missing an item, take it to your licensee: a new
compliant consent may be needed before the window closes.

## POLICY-SERVICE: paying an ongoing fee, review more than 30 days overdue

**Source.** Practice policy. The fee-for-no-service findings in ASIC Report 499, *Financial advice:
Fees for no service* (2016), and the obligation in Corporations Act 2001 section 912A(1)(a) to
provide financial services efficiently, honestly and fairly. In New Zealand, Code of Professional
Conduct standard 1, treat clients fairly. Thirty days of grace is this system's default.

**Breach in the data.** An active client with an active fee arrangement whose review is more than
30 days past `last_review_on` plus `review_months`.

**Fix.** `/draft-review-invite`, then `record-review` once held.

## AU-SOA-BASIS: advice presented without its basis on file

**Source.** Corporations Act 2001 section 961B, the duty to act in the best interests of the client,
and section 947B, which requires a statement of advice to set out the advice and the basis on which
it is given.

**Breach in the data.** An AU advice file at `presented` or `implemented` with an empty `scope` or
`reasons`. The CLI will not move a file to those stages without them; this catches records loaded
any other way.

**Fix.** `move-advice` with `--scope` and `--reasons`, from the statement of advice as given.

## NZ-ADVICE-RECORD: advice presented without its nature, scope and reasons

**Source.** Financial Markets Conduct Act 2013 section 431J, as inserted by the Financial Services
Legislation Amendment Act 2019 (the client must understand the nature and scope of the advice and
its limits); Code of Professional Conduct for Financial Advice Services standard 3, give financial
advice that is suitable; and standard condition 1 of a financial advice provider licence, keep
adequate records of your financial advice service. The FMA's guidance is that records are kept for
at least seven years: [fma.govt.nz](https://www.fma.govt.nz/library/guidance-library/).

**Breach in the data.** An NZ advice file at `presented` or `implemented` with an empty `scope` or
`reasons`.

**Fix.** As for AU-SOA-BASIS.

## NZ-DISCLOSURE: advice presented with no disclosure date

**Source.** Financial Markets Conduct Regulations 2014, subpart 5A, regulations 229C to 229G:
information about the provider, fees, commissions and conflicts, given when the nature and scope of
the advice is known and again when the advice is given.

**Breach in the data.** An NZ advice file at `presented` or `implemented` with no
`disclosure_given_on`.

**Fix.** `move-advice --disclosure=<date>` once you have confirmed when it was given.

## AU-IDR-ACK: complaint not acknowledged by the next business day

**Source.** ASIC Regulatory Guide 271, *Internal dispute resolution*: acknowledge a complaint within
24 hours, or one business day, of receiving it.
[asic.gov.au](https://www.asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/).
This system counts a Friday or Saturday complaint as due on the Monday. It does not know public
holidays: add them in `/customise` if you need it exact.

**Fix.** `acknowledge-complaint --complaint=<ref>`.

## AU-IDR-30: complaint open more than 30 calendar days

**Source.** ASIC Regulatory Guide 271: give the complainant a written internal dispute resolution
response within 30 calendar days of receiving a standard complaint, or tell them why you cannot and
that they can go to the Australian Financial Complaints Authority.

**Fix.** `respond-complaint --complaint=<ref> --outcome="..."`. The written response itself is
drafted to `drafts/` and sent by a person.

## POLICY-NZ-COMPLAINT: NZ complaint open more than 20 days

**Source.** Practice policy. A financial advice provider must have an internal complaints process
and belong to an approved dispute resolution scheme; the timeframe is set by your own process and
your scheme's rules. Twenty days is this system's default. Set it to yours in `/customise`.

## AU-CPD: under 40 hours, or a category short, with 90 days of the CPD year left

**Source.** Corporations Act 2001 section 921BA and the Corporations (Relevant
Providers-Continuing Professional Development Standard) Determination 2018: at least 40 hours of
CPD each CPD year (36 for part-time advisers with the licensee's written consent), at least 70 per
cent approved by the licensee, with minimums of 5 hours technical competence, 5 hours client care
and practice, 5 hours regulatory compliance and consumer protection, and 9 hours professionalism
and ethics. ASIC's summary:
[asic.gov.au](https://asic.gov.au/regulatory-resources/financial-services/financial-advice/professional-standards/continuing-professional-development-cpd/).

**Breach in the data.** An AU adviser with 90 days or fewer left in their CPD year and either under
40 total hours or under a category minimum. Part-time hours and the 70 per cent approved share are
not checked: add them in `/customise` if your licensee needs it.

**Fix.** Plan the remaining hours. `add-cpd` as each one is done.

## POLICY-NZ-CPD: no CPD recorded in twelve months

**Source.** Code of Professional Conduct for Financial Advice Services standard 9, keep competence,
knowledge and skill up to date. The Code sets no hour count; this system flags an NZ adviser with
nothing recorded in a year.

---

## Adding your own rule

Ask `/customise` in plain words ("flag any client over 75 with no review in nine months"). It adds
a branch to the `compliance_findings` view in a new migration, a section to this file with the
source you give it, and a test. A rule without a source is a policy: give it a `POLICY-` code.
