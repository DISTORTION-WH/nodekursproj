import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  isAuth: boolean;
  children: ReactNode;
  role?: string | null;
  requiredRole?: string;
}

export default function ProtectedRoute({
  isAuth,
  role,
  requiredRole,
  children,
}: ProtectedRouteProps) {
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}