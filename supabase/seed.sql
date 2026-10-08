-- Demo data: a fictional advice practice with offices in Brisbane and Auckland.
-- Every name, client and figure is invented. Dates are relative to today, so the
-- overdue reviews, the lapsed consent and the late complaint are always there to find.
-- Safe to run twice: every row has a fixed id.

insert into advisers (id, code, name, role, jurisdiction, registration, cpd_year_starts) values
('a0000000-0000-0000-0000-000000000001','SR','Sarah Reid','adviser','AU','ASIC 000000001', current_date - 300),
('a0000000-0000-0000-0000-000000000002','JT','James Tan','adviser','AU','ASIC 000000002', current_date - 200),
('a0000000-0000-0000-0000-000000000003','MW','Mere Walker','adviser','NZ','FSP000003', current_date - 100),
('a0000000-0000-0000-0000-000000000004','LP','Lucy Park','paraplanner','AU','', null)
on conflict do nothing;

insert into clients (id, reference, name, kind, adviser_id, jurisdiction, status, service_package, review_months, last_review_on, client_since, email) values
('c0000000-0000-0000-0000-000000000001','C-1001','Robert and Ann Fielding','couple','a0000000-0000-0000-0000-000000000001','AU','active','Gold',12, current_date - 400, current_date - 2900,'fielding@example.com'),
('c0000000-0000-0000-0000-000000000002','C-1002','Priya and Dev Sharma','couple','a0000000-0000-0000-0000-000000000001','AU','active','Gold',12, current_date - 200, current_date - 1500,'sharma@example.com'),
('c0000000-0000-0000-0000-000000000003','C-1003','Margaret Dunn','individual','a0000000-0000-0000-0000-000000000002','AU','active','Silver',12, current_date - 380, current_date - 2200,'mdunn@example.com'),
('c0000000-0000-0000-0000-000000000004','C-1004','Chen Family Trust','entity','a0000000-0000-0000-0000-000000000002','AU','active','Gold',12, current_date - 90, current_date - 1800,'chen.trust@example.com'),
('c0000000-0000-0000-0000-000000000005','C-1005','Tom and Lisa Brennan','couple','a0000000-0000-0000-0000-000000000001','AU','active','Silver',12, current_date - 500, current_date - 3100,'brennan@example.com'),
('c0000000-0000-0000-0000-000000000006','C-1006','Hemi and Anna Parata','couple','a0000000-0000-0000-0000-000000000003','NZ','active','KiwiSaver Plus',12, current_date - 330, current_date - 900,'parata@example.co.nz'),
('c0000000-0000-0000-0000-000000000007','C-1007','Sophie Williams','individual','a0000000-0000-0000-0000-000000000003','NZ','active','Wealth',12, current_date - 420, current_date - 1300,'swilliams@example.co.nz'),
('c0000000-0000-0000-0000-000000000008','C-1008','Grant Holloway','individual','a0000000-0000-0000-0000-000000000002','AU','active','Transactional',12, null, current_date - 60,'gholloway@example.com'),
('c0000000-0000-0000-0000-000000000009','C-1009','Aroha Ngata','individual','a0000000-0000-0000-0000-000000000003','NZ','prospect','',12, null, null,'aroha.n@example.co.nz'),
('c0000000-0000-0000-0000-000000000010','C-1010','David and Kim Osei','couple','a0000000-0000-0000-0000-000000000001','AU','active','Gold',12, current_date - 30, current_date - 700,'osei@example.com'),
('c0000000-0000-0000-0000-000000000011','C-1011','Westbrook Super Fund','entity','a0000000-0000-0000-0000-000000000002','AU','active','Gold',12, current_date - 340, current_date - 2600,'westbrook.smsf@example.com'),
('c0000000-0000-0000-0000-000000000012','C-1012','Fiona McLeod','individual','a0000000-0000-0000-0000-000000000001','AU','ceased','',12, current_date - 800, current_date - 4000,'')
on conflict do nothing;

insert into fee_arrangements (id, client_id, reference, annual_fee, currency, services, accounts, entered_on, next_reference_day) values
('f0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','OFA-1001',4400,'AUD','Annual review, two portfolio check-ins, Centrelink liaison','Super platform account ending 4410; investment account ending 7720', current_date - 2900, current_date - 160),
('f0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','OFA-1002',5500,'AUD','Annual review, quarterly cash flow check, tax time pack','Super platform accounts ending 1102 and 1103', current_date - 1500, current_date + 20),
('f0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003','OFA-1003',3300,'AUD','Annual review, aged care cost check','Investment account ending 3301', current_date - 2200, current_date - 120),
('f0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000004','OFA-1004',6600,'AUD','Annual review, trust distribution meeting, two portfolio check-ins','Trust investment account ending 4404', current_date - 1800, current_date + 200),
('f0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000005','OFA-1005',3300,'AUD','Annual review, super check','Super platform account ending 5505', current_date - 3100, current_date + 40),
('f0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000006','OSA-1006',1800,'NZD','Annual KiwiSaver review, fund switch advice when needed','Invoiced annually', current_date - 900, current_date + 10),
('f0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000007','OSA-1007',2400,'NZD','Annual review, portfolio rebalance','Investment platform account ending 7007', current_date - 1300, current_date + 90),
('f0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000010','OFA-1010',5500,'AUD','Annual review, quarterly check-in, estate planning referral','Super platform account ending 1010', current_date - 700, current_date + 300),
('f0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000011','OFA-1011',7700,'AUD','Annual review, SMSF strategy meeting, auditor liaison','SMSF cash account ending 1111', current_date - 2600, current_date - 30)
on conflict do nothing;

insert into consents (id, arrangement_id, signed_on, for_reference_day, services_listed, accounts_listed, termination_date_stated, document, recorded_by) values
('b0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002', current_date - 350, current_date - 345, true, true, true, 'demo://consents/OFA-1002-prior.pdf','Lucy Park'),
('b0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000004', current_date - 165, current_date - 165, true, false, true, 'demo://consents/OFA-1004.pdf','Lucy Park'),
('b0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000010', current_date - 60, current_date - 65, true, true, true, 'demo://consents/OFA-1010.pdf','Lucy Park')
on conflict do nothing;

insert into advice_files (id, client_id, reference, topic, document_kind, stage, stage_since, prepared_by, scope, reasons, disclosure_given_on, presented_on, implemented_on, advice_fee) values
('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','A-2001','Retirement income plan','SOA','drafting', current_date - 24,'Lucy Park','Retirement income and super; excludes estate planning','', null, null, null, 3300),
('d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000008','A-2002','Income protection and life cover','SOA','compliance check', current_date - 12,'Lucy Park','Personal insurance only','Cover sized to two years of expenses and the mortgage', null, null, null, 2200),
('d0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000006','A-2003','KiwiSaver fund choice','advice record','presented', current_date - 20,'Mere Walker','KiwiSaver fund selection; excludes other investments','Ten year horizon to first home and a stated growth risk profile', null, current_date - 20, null, 0),
('d0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003','A-2004','Aged care accommodation','SOA','presented', current_date - 9,'Lucy Park','Aged care fees and the family home; excludes estate planning','', null, current_date - 9, null, 4400),
('d0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000010','A-2005','Portfolio rebalance','ROA','implemented', current_date - 40,'Lucy Park','Rebalance within the existing strategy','Drift past the agreed bands after the market move', null, current_date - 55, current_date - 40, 0),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000009','A-2006','First home and KiwiSaver','advice record','fact find', current_date - 41,'Mere Walker','','', null, null, null, 0),
('d0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000005','A-2007','Super consolidation','SOA','research', current_date - 33,'Lucy Park','Consolidating three super accounts','', null, null, null, 2200)
on conflict do nothing;

insert into reviews (id, client_id, held_on, adviser_id, kind, summary, actions) values
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000010', current_date - 30,'a0000000-0000-0000-0000-000000000001','annual','Goals unchanged; rebalanced after drift','Estate planning referral by month end'),
('e0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004', current_date - 90,'a0000000-0000-0000-0000-000000000002','annual','Trust distributions agreed for the year','Send minutes to the accountant'),
('e0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', current_date - 200,'a0000000-0000-0000-0000-000000000001','annual','Retirement date brought forward two years','Prepare retirement income SOA')
on conflict do nothing;

insert into complaints (id, client_id, reference, received_on, summary, acknowledged_on, responded_on, outcome) values
('90000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000005','K-301', current_date - 38,'Charged the ongoing fee with no review this year', current_date - 37, null, ''),
('90000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004','K-302', current_date - 6,'Distribution paperwork sent to the wrong trustee', null, null, ''),
('90000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000007','K-303', current_date - 12,'Rebalance delayed after instructions were given', current_date - 11, null, ''),
('90000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001','K-304', current_date - 220,'Platform statement address wrong', current_date - 220, current_date - 210,'Address corrected with the platform; apology sent')
on conflict do nothing;

insert into cpd (id, adviser_id, completed_on, hours, category, qualifying, activity) values
('80000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', current_date - 280, 6,'technical',true,'Retirement income strategies workshop'),
('80000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001', current_date - 200, 5,'client care',true,'Difficult conversations course'),
('80000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001', current_date - 150, 3,'regulatory',true,'Ongoing fee consent changes webinar'),
('80000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001', current_date - 90, 9,'ethics',true,'Code of ethics module'),
('80000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001', current_date - 40, 8,'general',false,'Industry conference sessions'),
('80000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000002', current_date - 150, 12,'technical',true,'SMSF technical day'),
('80000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000002', current_date - 100, 9,'ethics',true,'Code of ethics module'),
('80000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000003', current_date - 400, 10,'technical',true,'KiwiSaver provider briefings')
on conflict do nothing;

insert into file_notes (id, client_id, author, kind, note, created_at) values
('70000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Sarah Reid','call','Left a message about the annual review. Fictional demo record.', now() - interval '75 days'),
('70000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','Lucy Park','note','Super statements received for the retirement SOA. Fictional demo record.', now() - interval '5 days'),
('70000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000005','Sarah Reid','complaint','Client upset about the fee with no review. Complaint K-301 logged. Fictional demo record.', now() - interval '38 days'),
('70000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003','James Tan','meeting','Presented aged care options to Margaret and her daughter. Fictional demo record.', now() - interval '9 days'),
('70000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000007','Mere Walker','email','Apologised for the rebalance delay. Fictional demo record.', now() - interval '11 days'),
('70000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000011','James Tan','call','Auditor asked for the investment strategy minutes. Fictional demo record.', now() - interval '20 days'),
('70000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000010','Sarah Reid','meeting','Annual review held. Estate planning referral to follow. Fictional demo record.', now() - interval '30 days'),
('70000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000004','James Tan','meeting','Trustee meeting held, distributions agreed. Fictional demo record.', now() - interval '90 days')
on conflict do nothing;
