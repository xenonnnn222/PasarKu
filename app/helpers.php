<?php

function rupiah(int|float|string|null $amount): string
{
    return 'Rp '.number_format((float) $amount, 0, ',', '.');
}
function quantity(int|float|string|null $amount): string
{
    return rtrim(rtrim(number_format((float) $amount, 2, ',', '.'), '0'), ',');
}
