// client/src/app/AdminRoute.jsx
import { Navigate } from "react-router-dom";
import { getAdminToken } from "./shared/config/authToken";

const AdminRoute = ({ children }) => {
  const token = getAdminToken();

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default AdminRoute;
