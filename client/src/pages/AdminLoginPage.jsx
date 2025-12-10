import { useNavigate } from "react-router-dom";
import { useState } from "react";
import AdminLoginModal from "../features/admin-auth/ui/AdminLoginModal";

const AdminLoginPage = () => {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  const handleSuccess = () => {
    setOpen(false);
    navigate("/admin", { replace: true });
  };

  return (
    <div className="gz-login-page">
      <AdminLoginModal open={open} onSuccess={handleSuccess} />
    </div>
  );
};

export default AdminLoginPage;
