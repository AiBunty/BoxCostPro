# 🔐 ADMIN PANEL ACCESS CREDENTIALS

## ⚠️ CRITICAL SECURITY INFORMATION ⚠️

**DO NOT SHARE THESE CREDENTIALS WITH ANYONE!**  
**CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

---

## 🎯 Admin Login Details

**Access URL:** http://localhost:5000/admin.html

**Super Admin Email:** aibuntysystems@gmail.com  
**Temporary Password:** `Admin@2026!Temp`

---

## 📋 First Login Instructions

1. **Open Admin Panel:**
   - Go to: http://localhost:5000/admin.html
   - (NOT the regular user login at / or /login)

2. **Login with Credentials:**
   - Email: aibuntysystems@gmail.com
   - Password: Admin@2026!Temp

3. **Change Password Immediately:**
   - After logging in, go to Settings or Profile
   - Change the temporary password to a strong, secure password
   - Use at least 12 characters with uppercase, lowercase, numbers, and symbols

4. **Enable 2FA (Recommended):**
   - Navigate to Security Settings
   - Enable Two-Factor Authentication (2FA)
   - Scan the QR code with your authenticator app
   - Save backup codes in a secure location

---

## 🔧 Admin Panel Features

Once logged in, you'll have access to:

✅ **User Management** - Approve/reject user signups  
✅ **Approvals** - Review pending verification requests  
✅ **Email Configuration** - Setup SMTP for system emails  
✅ **Audit Logs** - View system activity and security logs  
✅ **Settings** - Configure system-wide settings  
✅ **Support** - Manage user support tickets  

---

## 🚨 Troubleshooting

### Issue: "Admin authentication required" error
**Solution:** Make sure you're logged in at `/admin.html` (not the regular user login). Admin uses a separate authentication system with session cookies.

### Issue: Can't access `/api/admin/*` endpoints
**Solution:** These endpoints require admin session cookies. You must login through the admin panel first.

### Issue: Forgot password
**Solution:** Run the script again to reset the password:
```bash
npx tsx --env-file=.env scripts/create-super-admin.js
```

---

## 🔒 Security Best Practices

1. **Change Default Password:** Never use the temporary password in production
2. **Enable 2FA:** Adds an extra layer of security
3. **Use Strong Passwords:** 12+ characters, mixed case, numbers, symbols
4. **Limit Admin Access:** Only grant admin rights to trusted personnel
5. **Monitor Audit Logs:** Regularly review admin activity logs
6. **IP Whitelisting:** Configure allowed IPs in the admin security settings

---

## 📞 Support

If you need to create additional admin accounts or have issues:
- Use the admin panel's User Management section
- Or contact the system administrator

---

**Last Updated:** January 6, 2026  
**Script Used:** `scripts/create-super-admin.js`  
**Status:** ✅ Admin account created successfully
