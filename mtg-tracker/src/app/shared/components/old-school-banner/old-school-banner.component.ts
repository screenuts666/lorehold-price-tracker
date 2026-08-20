import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../price-tracker/services/language.service';

@Component({
  selector: 'app-old-school-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './old-school-banner.component.html',
  styleUrls: ['./old-school-banner.component.scss']
})
export class OldSchoolBannerComponent {
  public langService = inject(LanguageService);

  title = input<string>('');
  description = input<string>('');
  inBargains = input<boolean>(false);
  dismiss = output<void>();
}
