import { useContext, useEffect } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "./context/AuthContext";
import { toast } from "react-hot-toast";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Please login first!");
    }
  }, [loading, user]);

  if (loading) {
    return null; // ya ek Loader dikhade
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
