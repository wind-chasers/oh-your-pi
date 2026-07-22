import { createRoot } from "react-dom/client";
import { WithStore } from "@view/atom";
import App from "@view/App";
import { applySavedDarkMode } from "@view/lib/theme";
import "./index.css";

applySavedDarkMode();

createRoot(document.getElementById("root")!).render(
	<WithStore>
		<App />
	</WithStore>,
);
