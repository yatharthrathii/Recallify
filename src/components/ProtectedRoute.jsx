import { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "./context/AuthContext";
import { toast } from "react-hot-toast";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return null; 
  }

  if (!user) {
    toast.error("Please login first!");
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
