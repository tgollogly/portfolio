-- Fix seed questions where option B duplicated option A (Lion/Lion).
UPDATE questions SET options = '["Lion","Leopard","Eagle","Bear"]' WHERE id IN ('e0316','e0324','e0344','e0372','e0376','e0380');
