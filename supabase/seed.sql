-- FieldQuote initial electrician price book. This seed is safe to re-run.

insert into public.company_settings (
  company_id, name, deposit_pct, tax_pct, quote_validity_days, labor_rate, working_hours
) values (
  '00000000-0000-0000-0000-000000000001',
  'FieldQuote Electrical',
  30, 20, 14, 65,
  '{"monday":"08:00-17:00","tuesday":"08:00-17:00","wednesday":"08:00-17:00","thursday":"08:00-17:00","friday":"08:00-17:00"}'::jsonb
) on conflict (company_id) do update set
  name = excluded.name,
  deposit_pct = excluded.deposit_pct,
  tax_pct = excluded.tax_pct,
  quote_validity_days = excluded.quote_validity_days,
  labor_rate = excluded.labor_rate,
  working_hours = excluded.working_hours;

insert into public.price_book_items (company_id, name, category, unit, unit_price, keywords) values
  ('00000000-0000-0000-0000-000000000001', 'Standard electrical call-out', 'Call-out', 'job', 85.00, 'call out emergency visit electrical issue electrician'),
  ('00000000-0000-0000-0000-000000000001', 'Emergency electrical call-out', 'Call-out', 'job', 145.00, 'urgent emergency power loss fault electrician'),
  ('00000000-0000-0000-0000-000000000001', 'Electrician labour', 'Labour', 'hour', 65.00, 'hourly labour electrician installation repair'),
  ('00000000-0000-0000-0000-000000000001', 'Electrical fault finding', 'Diagnosis & testing', 'hour', 75.00, 'fault finding tripping circuit no power electrical diagnosis'),
  ('00000000-0000-0000-0000-000000000001', 'EICR — up to 10 circuits', 'Diagnosis & testing', 'job', 180.00, 'EICR electrical installation condition report testing certificate 10 circuits'),
  ('00000000-0000-0000-0000-000000000001', 'EICR — additional circuit', 'Diagnosis & testing', 'unit', 12.00, 'EICR extra circuit testing inspection'),
  ('00000000-0000-0000-0000-000000000001', 'Minor works certificate', 'Diagnosis & testing', 'job', 45.00, 'minor works certificate electrical certification'),
  ('00000000-0000-0000-0000-000000000001', 'Electrical safety inspection', 'Diagnosis & testing', 'hour', 65.00, 'safety inspection electrical check landlord'),
  ('00000000-0000-0000-0000-000000000001', 'Double socket replacement', 'Accessories', 'unit', 55.00, 'double socket outlet replacement damaged socket'),
  ('00000000-0000-0000-0000-000000000001', 'USB socket installation', 'Accessories', 'unit', 70.00, 'USB socket outlet install charging point'),
  ('00000000-0000-0000-0000-000000000001', 'Light switch replacement', 'Accessories', 'unit', 45.00, 'light switch replacement broken switch'),
  ('00000000-0000-0000-0000-000000000001', 'Smoke alarm installation', 'Safety', 'unit', 85.00, 'smoke alarm detector install fire safety'),
  ('00000000-0000-0000-0000-000000000001', 'Consumer unit upgrade — 10 way', 'Consumer units & rewires', 'job', 620.00, 'consumer unit fuse board replacement 10 way RCD RCBO'),
  ('00000000-0000-0000-0000-000000000001', 'Consumer unit upgrade — 18 way', 'Consumer units & rewires', 'job', 820.00, 'consumer unit fuse board replacement 18 way RCD RCBO'),
  ('00000000-0000-0000-0000-000000000001', 'Surge protection device', 'Consumer units & rewires', 'unit', 110.00, 'SPD surge protection consumer unit'),
  ('00000000-0000-0000-0000-000000000001', 'Earthing and bonding upgrade', 'Consumer units & rewires', 'job', 190.00, 'earthing bonding gas water main upgrade electrical safety'),
  ('00000000-0000-0000-0000-000000000001', 'New radial circuit', 'Installations', 'job', 240.00, 'new circuit radial cable socket circuit installation'),
  ('00000000-0000-0000-0000-000000000001', 'New ring circuit', 'Installations', 'job', 360.00, 'new ring circuit socket circuit installation'),
  ('00000000-0000-0000-0000-000000000001', 'Kitchen appliance connection', 'Installations', 'unit', 95.00, 'oven hob cooker appliance connection kitchen'),
  ('00000000-0000-0000-0000-000000000001', 'Extractor fan installation', 'Installations', 'unit', 145.00, 'extractor fan bathroom kitchen ventilation install'),
  ('00000000-0000-0000-0000-000000000001', 'LED downlight installation', 'Lighting', 'unit', 58.00, 'LED downlight spot light recessed lighting install'),
  ('00000000-0000-0000-0000-000000000001', 'Pendant light fitting installation', 'Lighting', 'unit', 65.00, 'pendant light fitting ceiling light install'),
  ('00000000-0000-0000-0000-000000000001', 'Outdoor security light installation', 'Lighting', 'unit', 125.00, 'outdoor security light PIR external lighting'),
  ('00000000-0000-0000-0000-000000000001', 'EV charger site survey', 'EV charging', 'job', 95.00, 'EV charger survey electric vehicle charging assessment'),
  ('00000000-0000-0000-0000-000000000001', '7 kW EV charger installation', 'EV charging', 'job', 890.00, '7kW EV charger installation electric vehicle home charging'),
  ('00000000-0000-0000-0000-000000000001', 'EV charger load management unit', 'EV charging', 'unit', 230.00, 'EV charger load management CT clamp electrical'),
  ('00000000-0000-0000-0000-000000000001', 'Partial rewire — one room', 'Consumer units & rewires', 'job', 650.00, 'partial rewire room cables sockets lights'),
  ('00000000-0000-0000-0000-000000000001', 'Full property rewire survey', 'Consumer units & rewires', 'job', 195.00, 'full rewire property survey electrical installation'),
  -- HVAC / AC (for intake + draft-quote smoke tests)
  ('00000000-0000-0000-0000-000000000001', 'AC call-out / diagnosis', 'HVAC', 'job', 95.00, 'AC aircon air conditioning diagnosis call out not cooling fault'),
  ('00000000-0000-0000-0000-000000000001', 'Split-system AC installation', 'HVAC', 'job', 850.00, 'AC aircon air conditioning split system install installation new unit'),
  ('00000000-0000-0000-0000-000000000001', 'Window / portable AC install assist', 'HVAC', 'job', 180.00, 'window portable AC aircon install installation'),
  ('00000000-0000-0000-0000-000000000001', 'AC gas top-up / recharge', 'HVAC', 'job', 220.00, 'AC gas refrigerant recharge top up not cooling'),
  ('00000000-0000-0000-0000-000000000001', 'HVAC labour', 'HVAC', 'hour', 75.00, 'HVAC AC aircon labour hourly installation repair')
on conflict do nothing;
