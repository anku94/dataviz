import logging
import re


class BudgetNode:
    USD_TO_INR = 85
    INR_ONE_LAKH = 100000
    INR_ONE_CRORE = INR_ONE_LAKH * 100
    INR_ONE_LAKH_CRORE = INR_ONE_CRORE * INR_ONE_LAKH

    def __init__(self, name: str, total_init: float) -> None:
        self.name = name.strip()
        self.key = self.sanitize_str(name)
        self.total_init = total_init
        self.total_children = 0
        self.children: list["BudgetNode"] = []
        self.child_index: dict[str, int] = {}

    def sanitize_str(self, s: str) -> str:
        s = s.strip()
        s = re.sub(r"\s+", "", s)
        s = s.lower()
        return s

    def add_child(self, child_str: str, child_total: float) -> None:
        self.children.append(BudgetNode(child_str, child_total))
        self.total_children += child_total

        self.children = sorted(self.children, key=lambda x: x.total_init, reverse=True)
        child_keys = [child.key for child in self.children]
        child_idxes = list(range(len(self.children)))
        self.child_index = dict(zip(child_keys, child_idxes))

    def get_child(self, child_str: str) -> "BudgetNode":
        child_key = self.sanitize_str(child_str)
        if child_key in self.child_index:
            return self.children[self.child_index[child_key]]
        else:
            logging.warn(f'Child "{child_str}" not found in "{self.name}"')
            return None

    def __str__(self) -> str:
        return self.serialize(recursive=True)

    def serialize(self, recursive: bool = False, prefix="") -> str:
        total_init_str = self.serialize_amount(self.total_init)
        total_str = self.serialize_amount(self.total_children)
        unalloc_str = self.serialize_amount(self.total_init - self.total_children)

        label = f"{prefix}[BudgetNode] {self.name}"
        # label += f"\n{prefix} - [Key] {self.key}"
        if self.total_init > 0:
            label += f"\n{prefix} - [Total, Initialized] {total_init_str}"
            label += f"\n{prefix} - [Unallocated] {unalloc_str}"
        else:
            label += f"\n{prefix} - [Total] {total_str}"

        label += f"\n{prefix}- {len(self.children)} children\n"

        if recursive:
            for child in self.children:
                label += child.serialize(recursive=True, prefix=prefix + "\t")

        return label

    @classmethod
    def serialize_amount(cls, amount: float) -> str:
        usd = f"{cls.format_usd(amount)}"
        inr = f"{cls.format_inr(amount)}"
        return f"({usd}, {inr})"

    @classmethod
    def format_inr(cls, value: float) -> str:
        """Value is assumped to be in INR crores."""
        val_fmt = "₹ {:.0f}{}"
        value = value * cls.INR_ONE_CRORE

        if value < cls.INR_ONE_CRORE:
            return val_fmt.format(value / cls.INR_ONE_LAKH, "L")
        elif value < cls.INR_ONE_CRORE * cls.INR_ONE_LAKH:
            return val_fmt.format(value / cls.INR_ONE_CRORE, "Cr")
        else:
            return val_fmt.format(value / (cls.INR_ONE_CRORE * cls.INR_ONE_LAKH), "LCr")

    @classmethod
    def format_usd(cls, value: float) -> str:
        value = value * cls.INR_ONE_CRORE
        value = value / cls.USD_TO_INR

        val_fmt_1 = "${:-.0f}"
        val_fmt_2 = "${:.0f}"

        if value < 1e6:
            return val_fmt_1.format(value)
        elif value < 1e9:
            return val_fmt_2.format(value / 1e6) + "M"
        else:
            return val_fmt_2.format(value / 1e9) + "B"


class BudgetTree:
    def __init__(self):
        pass
