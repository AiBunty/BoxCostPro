-- Check admin permissions for aibuntysystems@gmail.com
SELECT 
  u.id,
  u.email,
  u.role,
  r.name as role_name,
  array_agg(p.name) as permissions
FROM users u
LEFT JOIN roles r ON u.role = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE u.email = 'aibuntysystems@gmail.com'
GROUP BY u.id, u.email, u.role, r.name;

-- Also check if manage_settings permission exists
SELECT * FROM permissions WHERE name = 'manage_settings';
