import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "./MainLayout";
import MoleculeTab from "./MoleculeTab";
import RunTab from "./RunTab";
import { ErrorBoundary } from "../components/Shared/ErrorBoundary";

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/molecule" replace />,
      },
      {
        path: "molecule",
        element: <MoleculeTab />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: "run",
        element: <RunTab />,
        errorElement: <ErrorBoundary />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;