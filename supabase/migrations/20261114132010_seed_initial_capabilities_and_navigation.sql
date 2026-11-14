-- Seed the initial public capabilities index and navigation for the Noctra Hours CMS.
insert into public.admin_content(resource,title,slug,summary,status,sort_order,data) values
 ('capabilities','Strategy & Discovery','strategy-discovery','Clarify business requirements, customer journeys and the right digital direction before development begins.','published',1,'{"display_number":"01","tag":"STRATEGY","href":"/process","related_services":["Website Development","Business Systems"]}'),
 ('capabilities','Experience & Interface Design','experience-interface-design','Shape clear, considered interfaces that make digital products easier to understand and use.','published',2,'{"display_number":"02","tag":"DESIGN","href":"/services/web-development","related_services":["Website Development","Ecommerce Development"]}'),
 ('capabilities','Engineering & Integration','engineering-integration','Build dependable web experiences and connect the tools, data and workflows behind them.','published',3,'{"display_number":"03","tag":"ENGINEERING","href":"/services/digital-systems","related_services":["Web Application Development","Digital Infrastructure"]}'),
 ('capabilities','Continuous Care & Improvement','continuous-care-improvement','Maintain, monitor and evolve digital products beyond their initial release.','published',4,'{"display_number":"04","tag":"CONTINUOUS CARE","href":"/services/website-care","related_services":["Website Maintenance & Care","Business Systems"]}')
on conflict(resource,slug) do nothing;
insert into public.admin_content(resource,title,slug,summary,status,sort_order,data) values
 ('navigation','Home','home','','published',1,'{"label":"Home","href":"/"}'),
 ('navigation','Services','services','','published',2,'{"label":"Services","href":"/services"}'),
 ('navigation','Work','work','','published',3,'{"label":"Work","href":"/work"}'),
 ('navigation','About','about','','published',4,'{"label":"About","href":"/about"}'),
 ('navigation','Insights','insights','','published',5,'{"label":"Insights","href":"/insights"}'),
 ('navigation','Contact','contact','','published',6,'{"label":"Contact","href":"/contact"}')
on conflict(resource,slug) do nothing;