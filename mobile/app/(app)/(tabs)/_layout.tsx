import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/components/LocaleProvider";

export default function TabLayout() {
  const { t } = useLocale();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#111318",
          borderTopColor: "#1e2029",
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: "#6c63ff",
        tabBarInactiveTintColor: "#6b7280",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("dashboard"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: t("files.tab"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "folder" : "folder-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      {/* La lista documenti a database esce dalla tab bar: Milo Office e' un
          generatore e gestore di file, e la scheda "File" mostra i file veri
          presenti sul dispositivo. La rotta resta raggiungibile via
          router.push, quindi nessun link esistente si rompe. */}
      <Tabs.Screen
        name="invoices"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="quotes"
        options={{ href: null }}
      />
      {/* Note spese, Promemoria e Rubrica escono dalla tab bar per lo stesso
          motivo di Documenti, Preventivi e Clienti: sono attrezzi da gestionale
          — rimborsi, scadenze da ricordare, anagrafiche — e stare accanto a
          "File" raccontava un prodotto che Milo Office non e' piu'. Come le
          altre, restano raggiungibili via router.push: `href: null` toglie la
          voce dalla barra, non la rotta. */}
      <Tabs.Screen
        name="expenses"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="reminders"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="contacts"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      {/* clients route rimane attiva per retrocompatibilità ma nascosta dalla tab bar */}
      <Tabs.Screen
        name="clients"
        options={{ href: null }}
      />
    </Tabs>
  );
}
